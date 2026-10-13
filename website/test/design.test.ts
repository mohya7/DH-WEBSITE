import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkDesignLoading, checkDesignOutput, expectedLoads } from "../scripts/check-output";
import { checkDesign, checkSets, defaultRef, designFiles, gitReader, sha256 } from "../scripts/design-sources";
import { designFileList, designHash, designSourceDir, publishDesign } from "../src/design/folder";
import { designSetFor, designSets, type DesignSetName } from "../src/design/sets";
import { buildRoutes } from "../src/content/routes";
import { snapshotContent, tempDir } from "./helpers";

const read = (name: string) => fs.readFileSync(path.join(designSourceDir, ...name.split("/")));

describe("ported design files", () => {
  it("are byte for byte the source, except the one recorded change", () => {
    for (const file of designFiles) {
      const ported = read(file.dest);
      if (!file.change) {
        expect(sha256(ported), file.dest).toBe(file.sourceSha256);
        continue;
      }
      const lines = ported.toString("utf8").split("\n");
      expect(lines[file.change.line - 1]).toBe(file.change.after);
      lines[file.change.line - 1] = file.change.before;
      expect(sha256(Buffer.from(lines.join("\n"), "utf8")), `${file.dest} with the change undone`).toBe(file.sourceSha256);
    }
  });

  it("have exactly one change: the ?v= removed from hero-fluid.js's import", () => {
    const changed = designFiles.filter((file) => file.change);
    expect(changed.map((file) => [file.dest, file.change!.line, file.change!.before, file.change!.after])).toEqual([
      ["js/hero-fluid.js", 7, 'import WebGLFluid from "./webgl-fluid-lib.js?v=26";', 'import WebGLFluid from "./webgl-fluid-lib.js";'],
    ]);
  });

  it("keep about-page.css's stray brace, unfixed (3.5)", () => {
    const lines = read("css/about-page.css").toString("utf8").split("\n");
    expect(lines[174]).toBe("}");
    expect(lines[175]).toBe("}");
    expect(lines[177]).toBe("/* Services / constellation */");
    expect(lines[178]).toMatch(/^\.about-services\{/);
  });

  it("are exactly the listed files, protected from line-ending conversion", () => {
    expect(designFileList()).toEqual(designFiles.map((file) => file.dest).sort());
    expect(fs.readFileSync(path.join(designSourceDir, ".gitattributes"), "utf8")).toBe("* -text\n");
  });

  it("are all used: by a design set, or referenced from another ported file", () => {
    const fromSets = new Set(Object.values(designSets).flatMap((set) => [
      ...set.head.map((item) => item.href),
      ...Object.values(set.scripts).flat().map((script) => script!.src),
    ]));
    const referenced = new Set(["js/webgl-fluid-lib.js", "assets/careers/apply-now.svg", "assets/careers/hero.webp"]);
    for (const name of designFileList()) expect(fromSets.has(name) || referenced.has(name), name).toBe(true);
    for (const href of fromSets) if (!/^https?:/.test(href)) expect(fs.existsSync(path.join(designSourceDir, href)), href).toBe(true);
    expect(read("js/hero-fluid.js").toString()).toContain('from "./webgl-fluid-lib.js"');
    expect(read("css/careers-page.css").toString()).toContain("url(../assets/careers/apply-now.svg)");
    expect(read("css/careers-page.css").toString()).toContain("url(../assets/careers/hero.webp)");
  });

  it("do not include what was decided not to port", () => {
    const names = designFileList();
    for (const excluded of ["content/site-content.js", "js/content-runtime.js", "js/webgl-fluid.mjs"]) expect(names).not.toContain(excluded);
  });

  const hasSource = (() => {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", defaultRef], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  it.skipIf(!hasSource)(`match ${defaultRef}, and every design set matches the old pages it came from`, () => {
    const reader = gitReader(defaultRef);
    expect(checkDesign(reader).filter((row) => row.status === "MISMATCH")).toEqual([]);
    expect(checkSets(reader)).toEqual([]);
  });
});

describe("the content-hashed design folder", () => {
  it("has a hash that covers every file's path and bytes", () => {
    const dir = tempDir("design");
    fs.cpSync(designSourceDir, dir, { recursive: true });
    const before = designHash(dir);
    expect(designHash(dir)).toBe(before);
    expect(designHash(dir)).toBe(designHash());
    fs.appendFileSync(path.join(dir, "css", "tv.css"), " ");
    expect(designHash(dir)).not.toBe(before);
    fs.renameSync(path.join(dir, "css", "tv.css"), path.join(dir, "css", "tv2.css"));
    expect(designHash(dir)).not.toBe(before);
  });

  it("is published byte for byte with its layout unchanged, replacing any older folder", () => {
    const publicRoot = path.join(tempDir("public"), "design");
    fs.mkdirSync(path.join(publicRoot, "0000000000000000"), { recursive: true });
    const { hash, files } = publishDesign(designSourceDir, publicRoot);
    expect(fs.readdirSync(publicRoot)).toEqual([hash]);
    expect(files).toBe(designFiles.length);
    for (const name of designFileList()) expect(fs.readFileSync(path.join(publicRoot, hash, name)).equals(read(name)), name).toBe(true);
    expect(fs.existsSync(path.join(publicRoot, hash, ".gitattributes"))).toBe(false);
  });

  it("is a reserved path no page can take", () => {
    const content = snapshotContent();
    content.pages[1].path = "/design";
    expect(() => buildRoutes(content)).toThrow(/reserves/);
  });
});

describe("design sets", () => {
  it("are chosen per page type as decided; 404 and 500 use the hub set", () => {
    expect(designSetFor("home", "home")).toBe("home");
    expect(designSetFor("page", "about")).toBe("about");
    expect(designSetFor("page", "contact")).toBe("contact");
    expect(designSetFor("page", "careers")).toBe("careers");
    expect(designSetFor("page", "apply")).toBe("apply");
    for (const hub of ["partners", "cases", "blogs", "news"]) expect(designSetFor("page", hub)).toBe("hub");
    expect(designSetFor("partner", "microsoft")).toBe("hub");
    expect(designSetFor("service", "ai-automation")).toBe("service");
    expect(designSetFor("case-study", "ministry-planning")).toBe("case-study");
    expect(designSetFor("blog-post", "x")).toBe("blog-post");
    expect(designSetFor("vacancy", "x")).toBe("vacancy");
    expect(designSetFor("error", "error-404")).toBe("hub");
  });

  it("load GSAP, ScrollTrigger, and Lenis from jsDelivr at the end of the body on the home, about, and service pages only", () => {
    const withMotion = (Object.keys(designSets) as DesignSetName[]).filter((name) =>
      (designSets[name].scripts as Record<string, { src: string }[]>)["body-end"]?.some((script) => script.src.includes("gsap.min.js")),
    );
    expect(withMotion.sort()).toEqual(["about", "home", "service"]);
  });

  it("never load a script async or deferred", () => {
    for (const set of Object.values(designSets)) {
      for (const script of Object.values(set.scripts).flat()) expect(Object.keys(script!).sort()).toEqual(script!.src.endsWith("hero-fluid.js") ? ["module", "src"] : ["src"]);
    }
  });
});

describe("the built pages' loading check", () => {
  const html = (set: string, head: string, body: string) =>
    `<html><head>${head}<script src="/_next/static/chunks/a.js" async=""></script></head><body>${body.replace("<main>", `<main data-design-set="${set}">`)}</body></html>`;
  const d = "/design/abcdef0123456789/";
  const caseHead = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css"/><link rel="stylesheet" href="${d}css/shared.css"/><link rel="stylesheet" href="${d}css/responsive.css"/>`;
  const caseBody = `<main></main><script src="${d}js/shared.js"></script><script src="${d}js/nav-stay-on-page.js"></script>`;

  it("passes a page that loads exactly its set", () => {
    expect(checkDesignLoading("cases/x.html", html("case-study", caseHead, caseBody))).toEqual([]);
  });

  it("catches stylesheets out of order, a script from another set, a deferred script, and preloads from another set", () => {
    const swapped = caseHead.replace(`${d}css/shared.css`, "TMP").replace(`${d}css/responsive.css`, `${d}css/shared.css`).replace("TMP", `${d}css/responsive.css`);
    expect(checkDesignLoading("a.html", html("case-study", swapped, caseBody)).join("\n")).toMatch(/stylesheet/);
    expect(checkDesignLoading("b.html", html("case-study", caseHead, caseBody + `<script src="${d}js/hub-pages.js"></script>`)).join("\n")).toMatch(/body-end/);
    expect(checkDesignLoading("c.html", html("case-study", caseHead, caseBody.replace("shared.js\"", "shared.js\" defer"))).join("\n")).toMatch(/shared\.js defer/);
    expect(checkDesignLoading("d.html", html("case-study", `<link rel="preconnect" href="https://fonts.googleapis.com"/>${caseHead}`, caseBody)).join("\n")).toMatch(/preconnect/);
  });

  it("describes the home set with its hero module and module preloads", () => {
    expect(expectedLoads("home")).toMatchObject({
      modulepreload: ["js/hero-fluid.js", "js/webgl-fluid-lib.js"],
      "before-main": ["index.inline-1.js", "index.inline-2.js"],
      hero: ["js/hero-fluid.js module"],
    });
  });

  it("catches a published design file that differs, a second folder, and a ?v= import", () => {
    const dir = tempDir("design-src");
    fs.cpSync(designSourceDir, dir, { recursive: true });
    const out = tempDir("out");
    const { hash } = publishDesign(dir, path.join(out, "design"));
    const list = () => designFileList(out).map((name) => name);
    expect(checkDesignOutput(out, list(), dir)).toEqual([]);

    fs.appendFileSync(path.join(out, "design", hash, "css", "tv.css"), "x");
    fs.mkdirSync(path.join(out, "design", "0000000000000000"));
    fs.writeFileSync(path.join(out, "design", "0000000000000000", "a.css"), "");
    fs.writeFileSync(path.join(dir, "js", "hero-fluid.js"), 'import X from "./webgl-fluid-lib.js?v=27";\n');
    const problems = checkDesignOutput(out, list(), dir).join("\n");
    expect(problems).toMatch(/exactly one folder/);
    expect(problems).toMatch(/imports a module with a \?v= query string/);
  });
});

/*
 * The website ships static HTML with no client runtime (Section 3). Markup must
 * come from the build, never from client-side state or effects, and "use client"
 * is allowed only where listed, with the reason.
 */
const clientComponents: Record<string, string> = {
  "src/design/DesignHeadItems.tsx":
    "Next renders the 404 component into every page's payload as its not-found fallback. Resource hints from a server component there put the hub set's preloads on every page; a client component is only rendered where it is shown. It uses no state or effects.",
};

const stateOrEffectHooks = /\b(?:React\.)?(useEffect|useLayoutEffect|useInsertionEffect|useState|useReducer|useSyncExternalStore|useTransition|useDeferredValue|useOptimistic|useActionState|useFormStatus)\s*\(/;

function websiteSources(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push({ file: path.relative(process.cwd(), full).split(path.sep).join("/"), text: fs.readFileSync(full, "utf8") });
    }
  };
  walk(path.join(process.cwd(), "src"));
  // The section components render into the same static pages.
  walk(path.join(process.cwd(), "..", "packages", "blocks", "src"));
  return out;
}

function staticHtmlProblems(sources: { file: string; text: string }[], allowed: Record<string, string>): string[] {
  const problems: string[] = [];
  for (const { file, text } of sources) {
    const hook = stateOrEffectHooks.exec(text);
    if (hook) problems.push(`${file} uses ${hook[1]}.`);
    const client = /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use client["']/.test(text) || /^["']use client["']/m.test(text);
    if (client && !(file in allowed)) problems.push(`${file} is a client component but is not in the allowed list.`);
  }
  for (const file of Object.keys(allowed)) {
    const source = sources.find((entry) => entry.file === file);
    if (!source) problems.push(`${file} is listed as a client component but does not exist.`);
    else if (!/["']use client["']/.test(source.text)) problems.push(`${file} is listed as a client component but is not one.`);
    if ((allowed[file] ?? "").length < 40) problems.push(`${file} needs its reason.`);
  }
  return problems;
}

describe("static HTML only", () => {
  it("no website component uses React state or effect hooks, and \"use client\" appears only in the listed files", () => {
    expect(staticHtmlProblems(websiteSources(), clientComponents)).toEqual([]);
  });

  it("lists DesignHeadItems.tsx as the one client component, with its reason", () => {
    expect(Object.keys(clientComponents)).toEqual(["src/design/DesignHeadItems.tsx"]);
    expect(clientComponents["src/design/DesignHeadItems.tsx"]).toMatch(/not-found fallback/);
  });

  it("catches a hook, an unlisted client component, and a stale entry", () => {
    const problems = staticHtmlProblems(
      [
        { file: "src/a.tsx", text: 'import { useState } from "react";\nexport function A() { const [x] = useState(0); return <p>{x}</p>; }' },
        { file: "src/b.tsx", text: '/* note */\n"use client";\nexport function B() { return null; }' },
        { file: "src/c.tsx", text: 'export function C() { React.useEffect(() => {}); return null; }' },
      ],
      { "src/gone.tsx": "A reason long enough to count as a real explanation of why." },
    ).join("\n");
    expect(problems).toMatch(/src\/a\.tsx uses useState/);
    expect(problems).toMatch(/src\/b\.tsx is a client component but is not in the allowed list/);
    expect(problems).toMatch(/src\/c\.tsx uses useEffect/);
    expect(problems).toMatch(/src\/gone\.tsx is listed as a client component but does not exist/);
  });

  it("the build strips Next's client runtime and then checks for it", () => {
    const build = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")).scripts.build as string;
    expect(build).toMatch(/next build && tsx scripts\/strip-runtime\.ts && tsx scripts\/write-seo\.ts && tsx scripts\/write-web-config\.ts && tsx scripts\/check-output\.ts$/);
  });
});

describe("links", () => {
  it("are ordinary full-page links: nothing imports next/link", () => {
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) sources.push(full);
      }
    };
    walk(path.join(process.cwd(), "src"));
    walk(path.join(process.cwd(), "..", "packages", "blocks", "src"));
    for (const file of sources) expect(fs.readFileSync(file, "utf8"), file).not.toMatch(/from ["']next\/link["']/);
  });
});
