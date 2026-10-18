// A YAML reader for the security workflow. It covers the forms that file uses
// and the forms the self-test mutates: nested maps and lists, flow values,
// block scalars (including an explicit indent such as |2), and anchors.
// A form it does not understand throws, and the self-test treats that as a
// refusal rather than a pass.

export function parseWorkflowYaml(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let index = 0;

  function indentOf(line) {
    let count = 0;
    while (line[count] === " ") count += 1;
    if (line[count] === "\t") throw new Error("tabs are not accepted in the workflow");
    return count;
  }

  function contentIndent() {
    while (index < lines.length) {
      const line = lines[index];
      if (line.trim() !== "" && !line.trimStart().startsWith("#")) return indentOf(line);
      index += 1;
    }
    return null;
  }

  function parseValue(raw) {
    const textValue = raw.trim();
    if (textValue === "" || textValue === "~" || textValue === "null") return null;
    if (textValue === "true") return true;
    if (textValue === "false") return false;
    if (textValue.startsWith("[") || textValue.startsWith("{")) return parseFlow(textValue, 0).value;
    if ((textValue.startsWith("\"") && textValue.endsWith("\"")) || (textValue.startsWith("'") && textValue.endsWith("'"))) {
      return unquote(textValue);
    }
    if (/^-?\d+$/.test(textValue)) return Number(textValue);
    return textValue;
  }

  function unquote(token) {
    if (token.startsWith("'")) return token.slice(1, -1).replaceAll("''", "'");
    return token.slice(1, -1).replace(/\\([\\"nrt])/g, (_, ch) => ({ "\\": "\\", "\"": "\"", n: "\n", r: "\r", t: "\t" })[ch]);
  }

  function parseFlow(source, start) {
    const opener = source[start];
    const closer = opener === "[" ? "]" : "}";
    let cursor = start + 1;
    const items = [];
    const map = {};
    let mode = null;
    const skip = () => {
      while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    };
    const readToken = () => {
      skip();
      if (source[cursor] === "\"" || source[cursor] === "'") {
        const quote = source[cursor];
        let end = cursor + 1;
        while (end < source.length && source[end] !== quote) {
          if (source[end] === "\\") end += 1;
          end += 1;
        }
        const token = source.slice(cursor, end + 1);
        cursor = end + 1;
        return unquote(token);
      }
      if (source[cursor] === "[" || source[cursor] === "{") {
        const nested = parseFlow(source, cursor);
        cursor = nested.end;
        return nested.value;
      }
      const begin = cursor;
      while (cursor < source.length && source[cursor] !== "," && source[cursor] !== closer && source[cursor] !== ":") cursor += 1;
      return parseValue(source.slice(begin, cursor));
    };
    while (cursor < source.length) {
      skip();
      if (source[cursor] === closer) return { value: mode === "map" ? map : items, end: cursor + 1 };
      if (source[cursor] === ",") {
        cursor += 1;
        continue;
      }
      const token = readToken();
      skip();
      if (source[cursor] === ":") {
        cursor += 1;
        mode = "map";
        map[String(token)] = readToken();
      } else {
        mode = mode ?? "list";
        items.push(token);
      }
    }
    throw new Error("a flow value is not closed");
  }

  function blockScalar(header, keyIndent) {
    const match = /^[|>]([+-]?)(\d+)?([+-]?)$/.exec(header);
    if (!match) throw new Error(`unsupported block scalar ${header}`);
    const explicit = match[2] ? keyIndent + Number(match[2]) : null;
    const collected = [];
    index += 1;
    let contentIndent = explicit;
    while (index < lines.length) {
      const line = lines[index];
      if (line.trim() === "") {
        collected.push("");
        index += 1;
        continue;
      }
      const indent = indentOf(line);
      if (contentIndent === null) contentIndent = indent;
      if (indent < contentIndent) break;
      collected.push(line.slice(contentIndent));
      index += 1;
    }
    while (collected.length > 0 && collected[collected.length - 1] === "") collected.pop();
    return collected.join("\n");
  }

  function parseBlock(minIndent) {
    const first = contentIndent();
    if (first === null || first < minIndent) return null;
    const body = lines[index].slice(first);
    if (body === "-" || body.startsWith("- ")) return parseSequence(first);
    return parseMapping(first);
  }

  function parseSequence(seqIndent) {
    const items = [];
    while (index < lines.length) {
      const saved = index;
      const first = contentIndent();
      if (first === null || first !== seqIndent) {
        index = saved;
        break;
      }
      let rest = lines[index].slice(seqIndent + 1).trimStart();
      rest = rest.replace(/^&\S+\s*/, "");
      index += 1;
      if (rest === "") {
        items.push(parseBlock(seqIndent + 1));
        continue;
      }
      if (rest.startsWith("[") || rest.startsWith("{")) {
        items.push(parseFlow(rest, 0).value);
        continue;
      }
      const nestedKey = /^([^:]+):(.*)$/.exec(rest);
      if (!nestedKey) {
        items.push(parseValue(rest));
        continue;
      }
      const item = {};
      assignKey(item, nestedKey[1].trim(), nestedKey[2], seqIndent + 2, seqIndent);
      while (index < lines.length) {
        const look = index;
        const next = contentIndent();
        if (next === null || next < seqIndent + 1 || next === seqIndent) {
          index = look;
          break;
        }
        const row = lines[index].slice(next);
        const pair = /^([^:]+):(.*)$/.exec(row);
        if (!pair) throw new Error(`expected a key in a list item: ${row}`);
        index += 1;
        assignKey(item, pair[1].trim(), pair[2], next + 2, next);
      }
      items.push(item);
    }
    return items;
  }

  function parseMapping(mapIndent) {
    const map = {};
    while (index < lines.length) {
      const saved = index;
      const first = contentIndent();
      if (first === null || first !== mapIndent) {
        index = saved;
        break;
      }
      const row = lines[index].slice(mapIndent);
      if (row.startsWith("- ") || row === "-") {
        index = saved;
        break;
      }
      const pair = /^([^:]+):(.*)$/.exec(row);
      if (!pair) throw new Error(`expected a key: ${row}`);
      index += 1;
      assignKey(map, pair[1].trim().replace(/^&\S+\s*/, ""), pair[2], mapIndent + 2, mapIndent);
    }
    return map;
  }

  function assignKey(map, key, remainder, childIndent, keyIndent) {
    const rest = remainder.trim();
    if (/^[|>]/.test(rest)) {
      map[key] = blockScalar(rest, keyIndent);
      return;
    }
    if (rest !== "") {
      map[key] = parseValue(rest);
      return;
    }
    const saved = index;
    const next = contentIndent();
    if (next === null || next < childIndent) {
      index = saved;
      map[key] = null;
      return;
    }
    index = saved;
    map[key] = parseBlock(childIndent);
  }

  const document = parseBlock(0);
  return document;
}

export function collectRunCommands(node, found = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectRunCommands(item, found);
    return found;
  }
  if (node && typeof node === "object") {
    if (typeof node.run === "string") found.push(node.run);
    for (const value of Object.values(node)) collectRunCommands(value, found);
  }
  return found;
}
