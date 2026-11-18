# ADM-03: test report

## Round 1

Tester and security engineer, 11 November 2026.

- **Commit tested:** `59d3c65` (`59d3c657f5af5c03f005b31c7269103009f70c0b`), branch
  `change/ADM-03`. Commits under test: `0975b00` (end-to-end red test), `da940bb`
  (render tests), `eff1880` (fix), `59d3c65` (`implementation.md`). Base `77296ba`.
- **Where:** a detached checkout of `59d3c65` in a worktree of my own,
  `/home/user/dh-test-adm03`, removed at the end. Node `v22.23.4`. No port was
  used, no process was started on a port or stopped, and nothing wrote to any
  database. I did not commit, push, rebase or amend, and changed no source,
  test, lockfile or workflow. This file is the only file written in the
  developer's worktree.
- **Read first:** `docs/changes/README.md`, `AGENTS.md`/`CLAUDE.md`,
  `ENGINEERING_STANDARDS.md` (not on this branch; read from
  `origin/claude/cool-heisenberg-mh6zx9`), `plan.md` round 2, `plan-review.md`,
  `plan-approval.md` (16 conditions), `implementation.md`.
- **The developer's session was interrupted twice and gave no final report.**
  So every count in `implementation.md` was re-run here and is quoted from my
  own runs, not copied. All of them match.
- **The remote moved while I was testing.** My brief said only `0975b00` was
  pushed. At 04:08 UTC the remote branch `change/ADM-03` moved to `59d3c65`
  (`git ls-remote origin change/ADM-03`). I did not push it. The red run on
  `0975b00` had already ended in `failure` at 04:08:00, before the new head's
  runs started at 04:08:37, so condition 13's order was kept (section 3).

### 1. The red test was red, and is green on the head

Setup, in `/home/user/dh-test-adm03/studio`:

```
$ npm ci                                          exit 0
found 0 vulnerabilities
$ git diff --exit-code -- studio/package-lock.json studio/package.json; echo $?
0
```

**Red, on a checkout of `da940bb`** (`git checkout --detach da940bb` in my
worktree; the developer's red run was on a working tree, mine is on the commit):

```
$ npx tsc -b; echo $?
0
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 failed (1)
      Tests  12 failed | 2 passed (14)
1
$ npm test; echo $?
 ❯ test/richText.test.tsx (14 tests | 12 failed)
 Test Files  1 failed | 10 passed (11)
      Tests  12 failed | 62 passed (74)
1
```

Each red test fails on an assertion about the editor. The output has no
"is not a function" and no "is not defined" line (`grep -c` gives 0), so none
is a missing browser API or a setup error.

| Id | Message, as printed in my run |
| --- | --- |
| T1 | `AssertionError: expected [] to have a length of 1 but got +0` |
| T2 | `AssertionError: expected [] to have a length of 1 but got +0` |
| T4 | `AssertionError: expected false to be true // Object.is equality` |
| T5 | `AssertionError: expected [] to have a length of 1 but got +0` |
| T6 | `AssertionError: expected [ Array(1) ] to deeply equal [ …(2) ]` |
| T8 | `AssertionError: expected 'StartPasted\n\n\n\n' not to contain 'Pasted'` |
| T9 | `AssertionError: expected 1 to be +0 // Object.is equality` |
| T11 | `AssertionError: expected undefined to be true // Object.is equality` |
| T12 | `AssertionError: expected 'See \n\n' to contain 'See ![x](https://cdn.example/a.png)'` |
| T13 | `AssertionError: expected '{"type":"doc","content":[{"type":"par…' not to contain '"src"'` |
| T14 | `AssertionError: expected [] to deeply equal [ Array(1) ]` |
| T15 | `AssertionError: expected 'Before\n\nAfterPasted\n\n' to contain 'Other item'` |

T7 and T10 pass, as planned. These are the messages the plan gives. Outside
`richText.test.tsx`: 10 files, 60 tests, all passing.

`git diff da940bb 59d3c65 -- studio/test studio/e2e` is empty: the tests were
not touched after the red commit.

**Green, on `59d3c65`:**

```
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 passed (1)
      Tests  14 passed (14)
0
$ npm test; echo $?
 Test Files  11 passed (11)
      Tests  74 passed (74)
0
$ npx tsc -b; echo $?
0
$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build; echo $?
✓ built in 943ms
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
0
$ git status --short            (prints nothing)
$ git diff --exit-code -- studio/package-lock.json studio/package.json; echo $?
0
```

**The same 14 tests against the real server filter.** The render tests use a
fake of `/api/v1/rich-text/paste`. To check the fake has not drifted, I built a
scratch console (outside the repository) that compiles this commit's
`api/src/DigitalHub.Api/Content/RichText.cs` by link, in Release, and calls
`RichText.FilterPaste`. A scratch copy of `richText.test.tsx` with only the
fake swapped for that program: `Tests  14 passed (14)`, exit 0.

### 2. The test plan (plan 5.3), every command

| Command | Where | Exit | Result |
| --- | --- | --- | --- |
| `npm ci` | `studio/` | 0 | lockfile and `package.json` unchanged |
| `npx tsc -b` at `da940bb` | `studio/` | 0 | red state is "tests fail", not "does not compile" |
| `npx vitest run test/richText.test.tsx` at `da940bb` | `studio/` | 1 | `12 failed \| 2 passed (14)` |
| `npm test` at `da940bb` | `studio/` | 1 | `12 failed \| 62 passed (74)` |
| `npx vitest run test/richText.test.tsx` at `59d3c65` | `studio/` | 0 | `14 passed (14)` |
| `npm test` at `59d3c65` | `studio/` | 0 | `74 passed (74)`, 11 files |
| `npx tsc -b` at `59d3c65` | `studio/` | 0 | |
| `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | `studio/` | 0 | preview design check passes |
| `npm run test:e2e` (E1, E2 and the rest) | `studio/` | NOT RUN locally | No SQL Server and no API in this container; the harness needs `DigitalHubContent_E2e`. Covered by CI job `studio` ("Studio — typecheck, build, end-to-end"); see section 3 |
| `dotnet test -c Release` in `api/` | | NOT RUN locally | No `api/` file changes; the database tests need SQL Server. CI job `api` |
| `npm test`, `typecheck`, `build`, `design:check`, `compare:sections` in `website/` | | NOT RUN locally | No `website/` or `packages/` file changes. CI jobs `website`, website browser tests, `section-compare` (section 3) |
| The optional re-run of the server filter (plan 5.3) | scratch | 0 | Run through my own scratch console instead: section 1 (14 tests) and section 6 (probes) |

### 3. CI evidence on draft pull request #52

Read through the REST API (`gh api repos/mohya7/DH-WEBSITE/...`); nothing was
changed there.

**Red, on `0975b00` alone (plan 5.4, condition 13).** Run `42956506481`, job
`130312770458`, "Studio — typecheck, build, end-to-end": `completed`,
`failure`, 04:01:35 to 04:08:00 UTC. Steps: Typecheck, Unit tests and Build
succeeded; "End-to-end suite" failed. From the job log:

```
 Test Files  10 passed (10)
      Tests  60 passed (60)
  ✘   8 e2e/rich-text.spec.ts:88:1 › ADM-03 rich text: typing after a stored image keeps the image and the text (6.0s)
  ✘   9 e2e/rich-text.spec.ts:162:1 › ADM-03 rich text: an inserted image stays, and a pasted web image is filtered (10.0s)
  1) e2e/rich-text.spec.ts:88:1 › …
    Error: paste requests sent while typing
    > 140 |   expect(pastes.map((sent) => sent.postData()), "paste requests sent while typing").toEqual([]);
  2) e2e/rich-text.spec.ts:162:1 › …
    Error: paste requests sent while inserting and typing
    > 193 |   expect(pastes.map((sent) => sent.postData()), "paste requests sent while inserting and typing").toEqual([]);
  2 failed
  28 passed (4.5m)
```

E1 and E2 are the only failures, and each fails at the empty paste-request
assertion, the first assertion after the typing. The run was not cancelled.
Every other check run on `0975b00` is `success` (API, Website, website browser
tests, section comparison, both npm audits, NuGet audit, Semgrep, both gitleaks
scans, security gate self-test, actionlint) or `skipped` (CodeQL, screenshot
parity).

**Green, on `59d3c65`.** Run `42957284006`, job `130315262853`,
"Studio — typecheck, build, end-to-end": `completed`, `success`, 04:08:38 to
04:15:26 UTC. From the job log:

```
 Test Files  11 passed (11)
      Tests  74 passed (74)
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
  ✓   8 e2e/rich-text.spec.ts:88:1 › ADM-03 rich text: typing after a stored image keeps the image and the text (9.2s)
  ✓   9 e2e/rich-text.spec.ts:162:1 › ADM-03 rich text: an inserted image stays, and a pasted web image is filtered (11.9s)
  30 passed (4.7m)
```

So E1 and E2 pass in Chromium against the real API and `DigitalHubContent_E2e`:
real keystrokes after a stored image, the Image button, the synthetic paste
reaching the editor and the real paste route answering 200, a save and a
reload. The other 28 tests pass as before. Every other check run on `59d3c65`
is `success`: "API — Release build, migrations, integration tests", "Website —
typecheck, tests, design check, snapshot build", "Website — browser tests,
default and consent builds", "Section comparison against
feature/interviewer-portal", both npm audits, the NuGet audit, Semgrep, both
gitleaks scans, the security gate self-test and actionlint. CodeQL and
screenshot parity are `skipped`, as on `0975b00`. The remote head was still
`59d3c65` when I read these.

### 4. Scope and conditions 5 to 9 of `plan-approval.md`

Scope, from `git show --name-only` and `git diff 77296ba 59d3c65`:

| Commit | Files |
| --- | --- |
| `0975b00` | `studio/e2e/rich-text.spec.ts` |
| `da940bb` | `studio/test/richText.test.tsx`, `studio/test/support/pasteFilter.ts` |
| `eff1880` | `studio/src/content/RichTextEditor.tsx` |
| `59d3c65` | `docs/changes/ADM-03/implementation.md` |

- Outside `docs/changes/ADM-03/`, the branch changes exactly those four files.
- `git diff --quiet 77296ba 59d3c65 --` over `studio/src/content/MediaPicker.tsx`,
  `api`, `website`, `packages`, `.github`, `studio/package.json`,
  `studio/package-lock.json`, `studio/tsconfig*.json`, `studio/vitest.config.ts`,
  `studio/playwright.config.ts`, `studio/e2e/env.ts`, `studio/e2e/helpers.ts`,
  `studio/e2e/verification.spec.ts`, `studio/test/listPaging.test.tsx`,
  `studio/src/content/InlineTextEditor.tsx`: exit 0. None changed.
- `studio/test/support/pasteFilter.ts` has no `import` and no `from "` line
  (the only match for "import" is its own comment). It imports nothing.
- Each commit has the `ADM-03:` prefix, a body and the attribution trailer.
  The remote head equals the local head; `0975b00` is its ancestor (no rebase
  or amend).

| Condition | Result | Evidence |
| --- | --- | --- |
| 5. The invariant, beside the set and in `implementation.md` | Met | `RichTextEditor.tsx:54-71`: the three places, "safe only because every host passes `value` from the API or from this editor's own onChange", and the warning for any other host. `implementation.md` section 3 says the same and names `FormWalker.tsx:110` and `ErrorPagesPage.tsx:68`; both line numbers are right, and they are the only two users (`grep -rn RichTextEditor studio/src`). I read both hosts: `FormWalker` passes the item's field value, `ErrorPagesPage` passes `page.body` from `GET /api/v1/error-pages`, the editor's `onChange`, or the save's answer. `grep` for `localStorage`, `sessionStorage`, `useSearchParams`, `clipboard` in `studio/src` finds no other source for a rich-text value |
| 6. T13 pastes twice | Met | `richText.test.tsx:403-431`: `dropped(1)` after the first paste, `dropped(2)` after the second, each checking every request for `"src"`, `evil.example` and the foreign GUID, no image node, no `img` element, the last document, "Lure" and the notice. It is in `da940bb`, so it was part of the red test |
| 7. Ids are never removed, written down | Met in `implementation.md` (section 7 and section 11, "For ADM-05"). The pull request body: see finding 4 |
| 8. The `value` effect | Met | `implementation.md` section 3. Code, lines 210-217: the guard `cleanDocument(editor.getJSON()) === value` is unchanged; `noteMediaIds(next)` and `replaced.current += 1` are added where it calls `setContent` |
| 9. The set is its own thing | Met | `knownMediaIds` is written at lines 75 (`noteMediaIds`, called at 161 and 214 only) and 221 (`insertImage`), and read at line 82 only. `rememberedMedia` is not used in the file; `rememberMedia(choice.id, choice.path)` is still there, unchanged. `MediaPicker.tsx` is untouched. Probe S3 (section 6) proves it by running: an id the picker listed but the person did not choose is sent as `null` and dropped |

### 5. Security

- **Routes:** none added or changed (`git diff 77296ba 59d3c65 -- api` is
  empty). So the role matrix, host checks, unknown-field, body-size and
  error-shape checks have nothing new to cover; `POST /api/v1/rich-text/paste`
  keeps `[Authorize(Policy = "studio")]`. E2 calls the real route in CI.
- **No login or permission change.**
- **`npm audit --audit-level=high`, full tree:**
  - `studio/`: `found 0 vulnerabilities`, exit 0.
  - `website/`: exit 0. It reports `1 moderate severity vulnerability`, which
    is below the level, is not from this change (no lockfile changed) and is
    not a finding here.
- **`.github/security/run-npm-audit.sh`, `run-dotnet-audit.sh`:** NOT RUN
  locally: they need `$RUNNER_TEMP` and the CI gate inputs, and no dependency
  changed. Covered by `security.yml` jobs "npm audit (studio)", "npm audit
  (website)" and "NuGet vulnerable packages (api)": `success` on `0975b00` and
  on `59d3c65`.
- **Semgrep and gitleaks:** NOT RUN locally: neither is installed (`which
  semgrep gitleaks` finds nothing). Covered by `security.yml` jobs "Semgrep
  (ERROR fails, WARNING reported)", "Secret scan (gitleaks, this pull request's
  commits)" and "Secret scan (gitleaks, full history)": all `success` on
  `0975b00` and on `59d3c65`.
- **No secret in the diff or output.** A search of the added lines for
  password, secret, token and key patterns finds only the e2e spec reading
  `e2eAdminEmail` and `e2ePassword` from `e2e/env.ts`, as the other specs do.
- **What the change cannot do** is proved by T13 and by probes S1 to S3, U2, D1
  and E1 below.

### 6. Beyond the plan: my own probes

All in my worktree, as two untracked test files that are deleted with it
(copies are kept in the session scratchpad,
`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/tester/`).
They render the real `RichTextEditor`, `MediaPicker` and `ErrorPagesPage` in
jsdom. The paste route is answered by the **real** `RichText.FilterPaste`
(the scratch console of section 1), not by the fake. `Tests  17 passed (17)`
and `2 passed (2)`, exit 0. jsdom cannot type or lay out, so real keystrokes
and a real drop are covered only by E1 and E2.

| Probe | What was done | Result |
| --- | --- | --- |
| S1. Crafted `img[mediaid][src]` | Nine variants, each pasted twice: a foreign GUID with `src`; upper-case `MEDIAID` and id; the id in braces and without hyphens (both of which .NET's `Guid.TryParse` accepts); nested in a list, a table cell and a blockquote; a non-GUID with `src="javascript:…"` and `onerror`; a `data:` address; an empty and a bare `mediaid`. Then the same content dropped; pasted again; the field closed and reopened (as `FormWalker` does for a section) and pasted again | 21 requests. None contains the foreign id in any form, `evil.example`, `javascript` or `"src"`. No image node, no `img` element, and no `onChange` value ever holds the id. The drop was refused. **Neither a paste, a drop, nor a remount seeds the set** |
| S2. A known id with the page's own address and alt | `<img mediaid="<stored id, upper case>" src="https://evil.example/t.gif" alt="Attacker alt" decorative="true" onerror="x">` | Kept, as the plan's "worst case left" says: the library image, with the page's alt text and decorative flag. No address is sent, stored or rendered; the `img` element has no `src` and no `onerror`. `Validate` accepts the document |
| S3. An id the picker only listed | Open the picker so it lists an image, choose nothing, paste `img[mediaid]` with that id | Sent as `mediaId: null`, dropped. The set is not the picker's map (condition 9) |
| U1, U2. Undo and redo | Type, paste a copied library image with a web image, type while the answer is held, release; undo to the start; redo. Also undo and redo after a dropped crafted paste | Undo returns to the stored document with its image; redo gives back exactly the last `onChange` document; one paste request in all; a foreign id never comes back through the history |
| E1. The second host, `ErrorPagesPage` | Load a 404 body with a library image and a 500 body. Type " Edited." after the image; copy the 404's image into the 500 body; paste a crafted decorative image twice; Save both; type again after the save | No paste request while typing. The `PUT` bodies hold the image and "After Edited.", no `"src"`, no foreign id. `Validate` accepts both. Typing after the save still works |
| N1. Nested images | A known image inside a bullet list, an ordered list, a table cell, a blockquote, a paragraph, a link, beside struck and underlined text, after an `h1`, after `<br>` and `<hr>`; and a web image alone | Every known image is kept and every web image dropped. No exception. `Validate` accepts the editor's document after each. The first list item's text joins the paragraph the caret is in, as an ordinary paste does. A hard break and a rule are removed by the server filter when the paste carries an image (the server's rule, unchanged; ADM-22) |
| D1. Outside drop | `handleDrop` with: an image nested in a list, a known library image, a crafted image, a `data:` image only, text only; then a real `drop` event | Refused with the notice for the first three; not handled (left to ProseMirror) for the last two, where there is no image node. Document unchanged, no request |
| M1. Markdown image pattern | `See ![alt text](https://cdn.example/a.png "title") and ![](x.png)` passed key by key through `handleTextInput`; then `![p](…)` pasted as plain text | Stays text, exactly as typed. No image, no request |
| R1. Typing and selecting while an answer is in flight | (a) type, move the caret into "Before", release. (b) select the stored image, release. (c) select all, release | (a) nothing lost: the paste lands at the caret. (b) and (c): **finding 1** |
| R2. Two pastes answered in the other order | | `StartBBBAAA`: answer order, nothing lost, as the plan says |
| R3. Odd answers from the route | `document` that is not JSON, `null`, `{}`, missing, an unknown node type, a string body, an array body | Nothing inserted; the "could not be checked" notice (or the image notice for `{}` with `imagesDropped`). Fails closed. See observation (a) |
| R4. Empty field; a stored value not in the editor's own shape; a host that does not take the value back | | The paste lands in each case; the replaced-document counter does not misfire |
| R5. React `StrictMode` (as `main.tsx` uses) | Paste, type, release | One request; the paste lands; the image is kept. The mounted flag survives the double mount |
| R6. The field is closed and reopened while an answer is in flight | | Nothing inserted, `onChange` not called. See observation (b) |
| R7. An image file on the clipboard; a `data:` image | | File: notice, nothing pasted, no request (unchanged). `data:`: text pasted, no image, no request |
| R8. A large paste (3000 paragraphs, 443 kB) and a 40-deep blockquote | | Large: one request, pasted. Deep: the server filter drops what is deeper than its limit of 32, as `Validate` would on save (unchanged) |

### Findings

No Blocker. No Major.

**1. Minor. A selection made while a paste is being checked is replaced when
the answer arrives, so something can be lost. The plan and
`implementation.md` say "Nothing is lost".**

- Steps (probe F1): document "Start". Paste `<p>Pasted</p><img src="https://cdn.example/a.png" alt="Remote">`
  and hold the answer. Click "Image" and choose a library image. Release the
  answer.
- Expected (plan 3.1 (3), section 9 item 4; `implementation.md` section 9
  item 4: "Nothing is lost"): the library image and "Pasted" are both there.
- Actual: before the answer the editor has 1 image and a node selection on it;
  after the answer it has 0 images. The last `onChange` document is paragraphs
  "Start", "Pasted" and an empty one. The image just inserted is gone.
- Same cause (probes R1b, R1c): select the stored image, or select all, while
  the answer is out. The answer replaces the selection: the stored image is
  removed (R1b), or the whole document becomes "PasteC" (R1c). Undo brings it
  back.
- Why: `filteredPaste` runs `view.state.tr.replaceSelection(piece)` at the
  selection of that moment, and `insertImage` leaves the new image selected.
  With a caret nothing is lost; with any other selection the selection is.
- Why Minor and not Major: it needs an action inside the time of one request,
  nothing shows that a check is running, one undo restores it, and replacing a
  selection is what a paste does. But it removes a library image, which is this
  item's subject, and the record says it cannot happen. The developer or the
  architect decides whether to change the insert or only the wording; if it is
  left, it belongs in the "For ADM-22" note and in the pull request's
  behaviour list in true words.

**2. Minor. The "nothing was added" notice stays after a later paste that did
add something.**

- Steps (probe F2): stored document. Make the paste request fail; paste the
  editor's own image. Then let requests succeed and paste it again, as the
  notice asks.
- Expected: after the second paste the notice no longer says nothing was added.
- Actual: 2 images in the editor, and the notice still reads "The paste could
  not be checked, so nothing was added. Paste again."
- The same holds for the drop notice after a later good paste. A later paste
  that drops an image does replace it, with the image notice.
- "A notice, once shown, stays until the editor is reloaded" is already in the
  "For ADM-22" note. This is listed because the two notices this change adds
  are the ones that can now contradict what the person sees. No D-NNN entry
  exists for it; the G3 checklist asks for one for a Minor that is not fixed,
  or it is fixed here.

**3. Minor. Records: `implementation.md` is out of date on three points.**

- "Nothing is pushed" (header, sections 4 and 13): the branch is on the remote
  at `59d3c65` and the red run exists (section 3 above). The developer did not
  push; the record should say who did and when, with run `42956506481`.
- The coverage rows "Regression tests … E1 and E2 red: NOT RUN" and "Studio
  end-to-end test … NOT RUN" now have CI evidence.
- Section 9 item 4 and plan section 9 say "Nothing is lost" (finding 1).

**4. Minor. The pull request body does not yet have condition 14's three
sections.** `gh api repos/mohya7/DH-WEBSITE/pulls/52 --jq .body` shows the
draft text written for commit 1 only ("This draft holds only the plan records
and the end-to-end red test for now"), with no "Behaviour changes for the
owner", "For ADM-22" or "For ADM-05" heading, though the head is now the whole
change. It is the integrator's step and the pull request is still a draft; it
must be done before gate 2 (conditions 7 and 14).

### Observations, not findings

- **(a) The answer is trusted as it comes.** With a hand-made answer holding an
  image with an unknown id and a `src` (probe R3), the editor inserts it. Only
  the API can send that answer, and the real filter never does (it rebuilds
  the node and refuses `src`), so this is not reachable today. Passing the
  answer through the same known-id rule would cost one line. For the
  architect, if wanted.
- **(b) A paste whose field is closed before the answer is dropped without a
  word** (R6). There is nobody to tell; the clipboard still holds it.
- **(c) O-ADM03-2 is unanswered,** so a library image marked decorative with
  no alt text is inserted as not decorative and the save refuses the item
  until it is removed. Recorded by the developer for ADM-22 (section 10, last
  bullet). Not built, as condition 10 requires.
- **(d) O-ADM03-1:** I found no owner answer for ADM-03. The first push was
  made; by whom is for the integrator's record (finding 3). I did not push.
- **(e) The e2e spec's two differences from the plan's wording** (the "Edit"
  click; `body.focus()` before `Control+End`) weaken no assertion. Both are
  needed for the steps to reach the editor, and the red run shows both tests
  reaching the planned first assertion.

### Track checklist, G3

| Item | Result |
| --- | --- |
| The finding, its evidence and its fix come from the audit | Met: plan section 1 quotes ADM-03; the three fix lines are plan 3.1 items 2, 4 and 1, and the code does them (section 4, section 6) |
| The regression test is committed and shown failing before the fix | Met: `0975b00` and `da940bb` precede `eff1880`. Render tests red on `da940bb` here (section 1); E1 and E2 red in CI on `0975b00` alone (section 3) |
| The end-to-end suite gets a test for each Major | Met: E1 and E2 (ADM-03 is a Blocker) |
| A Minor that is not fixed becomes a D-NNN entry with an expiry | Open for findings 1 and 2 if they are not fixed: `docs/deferred-items.md` is not on this branch and, per plan section 1, has no entries. The items the plan moved go to ADM-22 and ADM-05 by note |
| G3-1 exit gate: reproduced before its fix and passing after it | Met locally and in CI: sections 1 and 3 |

### Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Fix: filter only real paste events, in `handlePaste` | Audit ADM-03, Fix 1 | Verified | T4, T7, T1, T2 red at `da940bb`, green at `59d3c65` (section 1); probes E1, M1, R7: no request without an image-carrying paste |
| Fix: keep image nodes with a valid `mediaId` | Audit ADM-03, Fix 2 | Verified | T1, T2, T6, T14 red then green; probes N1, U1, E1 against the real filter |
| Fix: never replace the document from `onUpdate` | Audit ADM-03, Fix 3 | Verified | Code lines 205-207; T1, T5 red then green; no `setContent` on the paste path |
| Inserting a library image keeps it | Audit ADM-03, bullet 3 | Verified | T2; E2 in CI (section 3) |
| Typing after an existing image keeps every character | Audit ADM-03, bullet 3 | Verified | T1 ("After Edited."); probe E1; E1 in CI (section 3) |
| A stored library image survives editing, saving and a reload | Audit ADM-03, title; FR-S-06 | Verified in CI; NOT RUN locally (no SQL Server) | E1, CI job `studio` (section 3) |
| A pasted web image is still dropped, with its notice | `docs/phase-b-studio.md` 7.7, 6.9 | Verified | T4; probes N1, S1 against the real filter; E2 in CI |
| The paste filter is still the server's | `docs/phase-b-studio.md` 7.7 | Verified | No `api/` change; the 14 render tests and all probes pass against the real `RichText.FilterPaste` (sections 1, 6); E2 against the real route in CI |
| No image without a media id enters by drop or by typing | Plan 2.3 (c) | Verified | T11, T12; probes D1, M1 |
| A pasted media id the session did not get from the API is dropped; no pasted address is sent or rendered | `plan-review.md` Round 1, finding 1; P-4 | Verified | T13 (twice) red then green; probes S1, S2, S3, U2, E1 |
| A paste, a drop or a remount cannot seed the set of known ids | `plan-review.md` Round 2, Minor 2; condition 6 | Verified | T13's second paste; probe S1 (paste twice, drop, close and reopen) |
| The set is not the picker's map | Condition 9 | Verified | Section 4; probe S3 |
| A paste answer never lands in a replaced document, or after the editor is gone | `plan-review.md` Round 1, finding 5 | Verified | T15, T9; probes R4, R5, R6 |
| What is typed or selected while a paste is checked is kept | Plan 3.1 (3), section 9 item 4 | Partly: typed text is kept; a selection is replaced | T5, probe R1a; finding 1 (probes F1, R1b, R1c) |
| The second host, `ErrorPagesPage` | Plan 2.2 | Verified | Probe E1 |
| Undo and redo | Tester | Verified | Probes U1, U2 |
| Nested images in lists and tables | Tester | Verified | Probe N1 |
| Library check on the error-page save | `plan-review.md` Round 1, finding 1 | Moved to ADM-05 | `implementation.md` section 11; not in the pull request body yet (finding 4) |
| Table cells with an image; an image copied in another tab; the picture shown; a notice clears; marks the server refuses | Plan section 4 | Moved to ADM-22 | `implementation.md` section 10; not in the pull request body yet (finding 4); finding 2 for the notices |
| A decorative library image is inserted as decorative | Plan 2.3 (c) | Not built: O-ADM03-2 unanswered. Moved to ADM-22 | `implementation.md` sections 8 and 10; observation (c) |
| Regression tests committed and shown failing before the fix | G3 checklist | Verified | Sections 1 and 3 |
| Studio end-to-end test for rich-text images | G3 exit gate | Verified in CI: red on `0975b00`, green on `59d3c65`; NOT RUN locally (no SQL Server) | CI job `studio` (section 3) |
| `tsc -b`, `npm test` and `npm run build` pass | Plan 5.3; CI `studio` | Verified | Section 1: exit 0, `74 passed (74)`, build exit 0 with the preview design check |
| Scope: commit 3 touches only `RichTextEditor.tsx`; no package, config, API or workflow change | Conditions 3, 11 | Verified | Section 4 |
| Conditions 5 to 9 | `plan-approval.md` | Verified (7's pull request half: finding 4) | Section 4 |
| No High or Critical advisory; no secret | Role checklist | Verified | Section 5 |

Every planned check passes, locally or in CI, and there is no Blocker or Major.
The four Minors go back to the developer and the integrator; findings 3 and 4
are records that gate 2 will read.

Round 1 result: APPROVED (no Blocker, no Major, four Minors).

## Round 2

Tester and security engineer, 11 November 2026. The developer answered findings
1 to 3 of round 1; finding 4 is the integrator's.

- **Commit tested:** `fb7615f` (`fb7615f090f3cebb01a1969d90f24ba74d2b00db`).
  New since round 1: `c4d93b9` (red, T16 to T21), `1177ac7` (fix), `fb7615f`
  (`implementation.md` section R). `f72dc56` is round 1 of this report,
  committed by someone else, unchanged.
- **Where:** a fresh detached worktree of `fb7615f`, `/home/user/dh-test-adm03`,
  removed at the end. Same rules as round 1: no commit, push, rebase or amend;
  no port; no database; no source, test, lockfile or workflow changed. This
  section is the only thing written.
- **The branch moved again while I was testing.** After `fb7615f` came
  `213cdb8` (plan round 3, the insert rule), `eb696cc` (six lines in
  `richText.test.tsx`: an order assertion in T16, T17 and T18) and `aef22b5`
  (record). The remote head is `aef22b5`. `git diff fb7615f aef22b5 -- studio/src`
  is empty: the editor is the same file at both commits. `fb7615f` is what I
  tested in full; section 5 says what I checked on `aef22b5`.

### 1. Red at `c4d93b9`, green at `fb7615f`

Setup: `npm ci` exit 0, `found 0 vulnerabilities`;
`git diff --exit-code -- studio/package-lock.json studio/package.json` exit 0.

**Red, on a checkout of `c4d93b9`:**

```
$ npx tsc -b; echo $?
0
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 failed (1)
      Tests  5 failed | 15 passed (20)
1
$ npm test
 Test Files  1 failed | 10 passed (11)
      Tests  5 failed | 75 passed (80)
```

| Id | Test | Message, as printed |
| --- | --- | --- |
| T16 | an image inserted while a paste is being checked is kept | `AssertionError: expected [] to deeply equal [ Array(1) ]` |
| T17 | an image selected while a paste is being checked is kept | `AssertionError: expected [] to deeply equal [ Array(1) ]` |
| T18 | a document selected while a paste is being checked is kept | `AssertionError: expected [] to deeply equal [ Array(1) ]` |
| T20 | a paste that is added clears the notice that nothing was added | `AssertionError: expected 'The paste could not be checked, so no…' to be null` |
| T21 | a paste that is added clears the notice that a drop was refused | `AssertionError: expected 'The dropped content included an image…' to be null` |

Each is an assertion about the editor; the output has no "is not a function"
or "is not defined" line. T19 (`a paste over a selection replaces that
selection`) passes, as a guard, with T1 to T15. The fourteen earlier tests are
unchanged: the diff of the test file only adds T16 to T21, a `keepSelection`
argument to the `paste` helper, and the helpers `selectImage` and `selectAll`.

**Green, on `fb7615f`:**

```
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 passed (1)
      Tests  20 passed (20)
0
$ npm test; echo $?
 Test Files  11 passed (11)
      Tests  80 passed (80)
0
$ npx tsc -b; echo $?
0
$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build; echo $?
✓ built in 830ms
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
0
$ git status --short            (prints nothing)
$ npm audit --audit-level=high
found 0 vulnerabilities
```

The 20 tests also pass with the fake swapped for the real
`RichText.FilterPaste` (the scratch console of round 1, rebuilt from this
commit's `RichText.cs`): `20 passed`, in the probe run below.

### 2. Scope

| Commit | Files |
| --- | --- |
| `c4d93b9` | `studio/test/richText.test.tsx` |
| `1177ac7` | `studio/src/content/RichTextEditor.tsx` |
| `fb7615f` | `docs/changes/ADM-03/implementation.md` |

`git diff --quiet 59d3c65 fb7615f --` over `studio/package.json`,
`studio/package-lock.json`, `studio/src/content/MediaPicker.tsx`, `api`,
`website`, `packages`, `.github`, `studio/e2e`: exit 0. The fix is 46 lines in
one file: `Selection` imported from `@tiptap/pm/state` (already a dependency),
`clearNotAddedNotice`, and the three-way insert in `filteredPaste`. The known-id
set, `withoutUnknownMediaIds`, `handleDrop`, the `value` effect and the request
are untouched, so conditions 5 to 9 stand as in round 1.

### 3. Probes, against the real server filter

The 19 probes of round 1 were run again on `fb7615f`, with six new ones
(L1 to L6): `Tests  1 failed | 44 passed (45)` over four files, which includes
the developer's 20 against the real filter. The one failure was an assertion
of my own that was wrong (it looked for "item one" unbroken, and the paste
correctly landed after the four selected characters, giving "item", the
pasted text, " one"). Corrected and re-run: passed. Nothing in the editor
failed.

**Round 1 findings, re-run:**

| Probe | Round 1 | Now |
| --- | --- | --- |
| F1. Image button used while a paste answer is out | 0 images after the answer | 1 image. Document: "Start", the image, "Pasted", empty paragraph |
| R1b. Stored image selected meanwhile | image removed | kept; pasted text after it (T17, and L4) |
| R1c. Whole document selected meanwhile | document replaced by the paste | kept; pasted text at the end (T18) |
| F2. Failed paste, then the same paste succeeds | notice still "nothing was added" | notice `null`, 2 images |

**New probes on the insert rule:**

| Probe | What was done | Result |
| --- | --- | --- |
| L1. A text range selected mid-paragraph meanwhile | Paste, select characters 2 to 5 of "Before", release | "BefoPasted", "re", image, "After": inserted straight after the selection, nothing replaced. Undo returns the exact document and the selection; redo returns the exact result |
| L2a. Pasted over "Before", then "After" selected instead | | Both kept; paste lands after "After" |
| L2b. Pasted over the whole document, then a key typed | | "xPasteB": the typed key replaced the selection, as typing does; the paste then lands at the caret |
| L2c. Pasted over a selection, selection moved away and back | | The paste-time selection is replaced (rule 2). Right: it is again what the person pasted over |
| L3. Two pastes over the same whole-document selection | | "OneTwo": the first replaces, the second lands at the caret. Both added |
| L3. A later selection inside a table cell, a list item and a code block | | Inserted after the selection in each; the table, list and stored image stay; `Validate` accepts the document after each |
| L5. Undo and redo after a late insert behind an inserted image | | Undo removes the paste and the image (one history group, made within the same half second); redo returns exactly the same document; `Validate` accepts it |
| L6. Notices, eleven steps | | A plain paste, or a checked paste that drops nothing, clears "could not be checked" and the drop notice. Typing does not. The image notice is never cleared and still replaces the others, as before (ADM-22) |

**Security, on the changed insert:**

| Probe | What was done | Result |
| --- | --- | --- |
| S1, S2, S3, U2, D1, E1 of round 1 | unchanged | All pass again: no foreign id, address or `"src"` in any request, document or `onChange` value; paste, drop and remount do not seed the set; an id the picker only listed is not known; the error-page host is clean |
| L4. Crafted `img[mediaid][src]` with a later selection, and over a selection | The crafted paste twice with the whole document selected while the answer is out (rule 3); twice pasted over a selection (rule 2); once more after closing and reopening the field; then eight undos and eight redos | 5 requests, none with the foreign id, `evil.example` or `"src"`. The only image in the editor is the stored one. The foreign id is in no `onChange` value and does not come back through the history |
| L4. The document is replaced while the answer is out, with a selection made in the new document | | Nothing inserted; "could not be checked" notice. The replaced-document check still runs before the insert rule |
| L4. Replaced and put back to the same document while the answer is out | Pasted over a whole-document selection; value set to another item and back | Nothing inserted; notice. The counter decides, not `doc.eq`, so an identical-looking document cannot make rule 2 replace it |

### 4. What I think of the rule

It is right, and it is now the plan's (`213cdb8`, 3.1 (3)), which I read against
the code: the three cases match.

- It keeps the round 1 behaviour wherever round 1 was not wrong (a caret), so
  E1 and E2 take the same path as before.
- Rule 2 needs both `doc.eq` and `selection.eq`. I tried to make it replace
  something the person did not paste over (L2a, L2b, L3, L4) and could not.
- Rule 3 puts the content after the selection's end. With a text range that
  can be mid-word (L1), exactly as the caret rule can when the caret is
  mid-word. Nothing is lost and one undo removes it.
- One thing to know, not a finding: a paste made straight after the Image
  button, with the new image still selected, replaces that image (rule 2). It
  is a paste over a selection, and a paste with no image does the same at
  once.

### 5. CI

**On `fb7615f`:** the "Studio — typecheck, build, end-to-end" job
(`130319940504`) and the API job (`130319940231`) are `cancelled`, at 04:24:57
and 04:24:43 UTC: the push of `aef22b5` cancelled them. A cancelled run is not
evidence. Website, website browser tests, section comparison, both npm audits,
NuGet audit, Semgrep and both gitleaks scans are `success` on `fb7615f`.
E1 and E2 on `fb7615f` itself: NOT RUN (no SQL Server here; the CI run was
cancelled). Covered by CI job `studio` on `aef22b5`, whose editor source is
identical.

**On `aef22b5`** (not the commit I tested; the only code difference is six
assertion lines in `richText.test.tsx`). In my worktree, as an extra:
`npx vitest run test/richText.test.tsx` `20 passed (20)`; `npm test`
`80 passed (80)`; `npx tsc -b` exit 0. CI: run `42959042545`, job
`130321040327`, "Studio — typecheck, build, end-to-end": `completed`,
`success`, 04:24:59 to 04:31:31 UTC. From the job log:

```
 Test Files  11 passed (11)
      Tests  80 passed (80)
  ✓   8 e2e/rich-text.spec.ts:88:1 › ADM-03 rich text: typing after a stored image keeps the image and the text (8.5s)
  ✓   9 e2e/rich-text.spec.ts:162:1 › ADM-03 rich text: an inserted image stays, and a pasted web image is filtered (11.7s)
  30 passed (4.6m)
```

Every other check run on `aef22b5` is `success` (API, Website, website browser
tests, section comparison, both npm audits, NuGet audit, Semgrep, both gitleaks
scans, security gate self-test, actionlint); CodeQL and screenshot parity are
`skipped`, as before. So E1 and E2 pass in Chromium against the real API with
the round 2 editor.

### Findings, round 2

No Blocker. No Major. Round 1's findings:

| Round 1 finding | State |
| --- | --- |
| 1. A later selection is replaced by the answer | Closed: T16 to T18 red then green; probes F1, R1b, R1c, L1 to L5 |
| 2. The "nothing was added" notice stays | Closed: T20, T21 red then green; probes F2, L6 |
| 3. `implementation.md` out of date | Closed at `fb7615f` for the three points named. See 5 below |
| 4. The pull request body lacks condition 14's three sections | Open, the integrator's; to be done before gate 2. Still the commit-1 text when I last read it |

New:

**5. Minor. Records lag the pushes again.** `implementation.md` section R (at
`fb7615f`) says "This round's commits are not pushed. CI on `c4d93b9` and
`1177ac7` is NOT RUN." They are pushed, and the run on `fb7615f` was cancelled.
`c4d93b9` was not pushed alone, so the round 2 red has no CI run; my local red
in section 1 is the evidence for it, and the unit tests are what was red (no
end-to-end test changed). The integrator's record should give the run on the
final head. Gate 2 should read CI on the head it approves, not on `fb7615f`.

**6. Minor, for gate 2. The tested commit is not the head.** `213cdb8`,
`eb696cc` and `aef22b5` came after `fb7615f`. I checked what section 5 says
and no more. The editor source is unchanged, so I do not ask for another full
round; if any `studio/src` file changes after `aef22b5`, it needs one.

### Coverage, round 2

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A selection made while a paste is checked is kept | Round 1 finding 1; plan 3.1 (3) round 3 | Verified | T16, T17, T18 red at `c4d93b9`, green at `fb7615f`; probes F1, L1, L2a, L3, L5 |
| A paste over a selection still replaces it | Plan 3.1 (3) rule 2 | Verified | T19 (guard); probes L2c, L3 |
| A paste that is added clears this change's two notices, and only those | Round 1 finding 2 | Verified | T20, T21 red then green; probes F2, L6 |
| A crafted media id is still dropped and never sent, on every insert path | Plan section 6; T13 | Verified | T13; probes S1, S2, S3, L4 |
| The known-id set is still seeded only from loaded documents and the picker | Conditions 5, 9 | Verified | Section 2 (those lines untouched); probes S1, S3, L4 |
| Undo and redo after a late insert | Tester | Verified | Probes L1, L5, U1, U2, L4 |
| A paste answer never lands in a replaced document | T15 | Verified | T15; probe L4 (twice) |
| The second host; nested images; drop; Markdown pattern | Round 1 | Verified again | Probes E1, N1, D1, M1 re-run |
| `tsc -b`, `npm test`, build | Plan 5.3 | Verified | Section 1: exit 0, `80 passed (80)`, build exit 0 with the preview design check |
| Scope: `1177ac7` touches only `RichTextEditor.tsx`; no package, config, API or workflow change | Conditions 3, 11 | Verified | Section 2 |
| E1 and E2 with the new insert | G3 exit gate | Verified in CI on `aef22b5` (same editor source); cancelled on `fb7615f`; NOT RUN locally | Section 5 |
| Records match what happened | Round 1 finding 3; P-8 | Partly | Finding 5 |
| Pull request body: three sections | Condition 14 | Open, integrator | Round 1 finding 4 |

Every planned check passes, locally on `fb7615f` or in CI on `aef22b5`, and
there is no Blocker or Major. Round 1's findings 1 to 3 are closed. Open: round
1 finding 4 and round 2 findings 5 and 6, all Minor, all records, all for the
integrator and gate 2.

Round 2 result: APPROVED (no Blocker, no Major). Lapsed: see round 3.

## Round 3

Tester and security engineer, 11 November 2026. A full round, as condition 28
of `plan-approval.md` ("Gate 1 again: plan round 4") asks, because `studio/src`
changed. My round 2 approval lapsed when E2 failed in CI on `7aece22`.

- **Commit tested:** `2e3f510` (`2e3f5109f465…`), the pushed head of
  `change/ADM-03`. New since round 2's head `aef22b5`, outside records:
  `48f256f` (T22, red), `10ef86d` (tests: T16's new document, T23, T24, E2
  without `Control+End`), `40ad04a` (fix, `RichTextEditor.tsx` only), `2e3f510`
  (`implementation.md` section 17). The remote head was still `2e3f510` when I
  finished.
- **Where:** a fresh detached worktree, `/home/user/dh-test-adm03`, removed at
  the end. No commit, push, rebase or amend; no port; no database; no source,
  test, lockfile or workflow changed. This section is the only thing written.
- **Read:** `plan.md` round 4, `plan-review.md` Round 4, `plan-approval.md`
  "Gate 1 again: plan round 4" (conditions 17 to 30), `implementation.md`
  sections 16 and 17.
- **What I missed in rounds 1 and 2.** Round 1's probe log already showed a
  pasted image carrying the editor's selected-node class, and round 2 wrote
  that a paste straight after the Image button replaces the new image, as
  "one thing to know, not a finding". I never asked what the next key does to
  a selected image. Gate 1 says the same of itself. This round asks it for
  every way an image comes to be selected, and that is where finding 1 below
  comes from.

### 1. Red, then green

Setup: `npm ci` exit 0, `found 0 vulnerabilities`;
`git diff --exit-code -- studio/package-lock.json studio/package.json` exit 0.

**Red, on a checkout of `48f256f`** (T22 alone):

```
$ npx tsc -b; echo $?
0
$ npx vitest run test/richText.test.tsx; echo $?
     × typing straight after inserting a library image keeps the image
AssertionError: expected [] to deeply equal [ Array(1) ]
      Tests  1 failed | 20 passed (21)
1
$ npm test
      Tests  1 failed | 80 passed (81)
```

**Red, on a checkout of `10ef86d`** (commit A; the editor is still `1177ac7`'s):

```
$ npx tsc -b; echo $?
0
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 failed (1)
      Tests  4 failed | 19 passed (23)
1
$ npm test
 Test Files  1 failed | 10 passed (11)
      Tests  4 failed | 79 passed (83)
```

| Id | Test | Message, as printed |
| --- | --- | --- |
| T16 | an image inserted while a paste is being checked is kept | `AssertionError: expected [ { type: 'paragraph', …(1) }, …(3) ] to deeply equal [ { type: 'paragraph', …(1) }, …(2) ]` |
| T22 | typing straight after inserting a library image keeps the image | `AssertionError: expected [] to deeply equal [ Array(1) ]` |
| T23 | inserting a library image before another image leaves neither selected | `AssertionError: expected [ Array(1) ] to deeply equal [ …(2) ]` |
| T24 | inserting a library image into an empty field keeps it when typing follows | `AssertionError: expected [] to deeply equal [ Array(1) ]` |

Each is an assertion about the editor; no "is not a function" or "is not
defined" line in either red run. These are the counts of condition 18.
Against `aef22b5`, the test file's diff adds the `typeAtSelection` helper, T22,
T23 and T24, and changes one thing in an existing test: T16's expected
document and its comment. No other test is edited.

**Green, on a checkout of `40ad04a`, and again on `2e3f510`** (same result on
both):

```
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 passed (1)
      Tests  23 passed (23)
0
$ npm test; echo $?
 Test Files  11 passed (11)
      Tests  83 passed (83)
0
$ npx tsc -b; echo $?
0
$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build; echo $?
✓ built in 815ms            (883ms on 2e3f510)
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
0
$ git status --short            (prints nothing)
$ git diff --exit-code -- studio/package-lock.json studio/package.json; echo $?
0
$ npm audit --audit-level=high
found 0 vulnerabilities
```

The 23 tests also pass with the fake swapped for the real
`RichText.FilterPaste` (scratch console, rebuilt from this commit's
`RichText.cs`).

### 2. Scope

| Commit | Files |
| --- | --- |
| `48f256f` | `studio/test/richText.test.tsx` |
| `10ef86d` | `studio/test/richText.test.tsx`, `studio/e2e/rich-text.spec.ts` |
| `40ad04a` | `studio/src/content/RichTextEditor.tsx` |
| `2e3f510` | `docs/changes/ADM-03/implementation.md` |

- Outside `docs/changes/ADM-03/`, the whole branch (`77296ba..2e3f510`) still
  changes four files only: the editor, the render test, its fake, the e2e spec.
- `git diff --quiet 77296ba 2e3f510 --` over `studio/package.json`,
  `studio/package-lock.json`, `studio/src/content/MediaPicker.tsx`, `api`,
  `website`, `packages`, `.github`, `studio/tsconfig*.json`,
  `studio/vitest.config.ts`, `studio/playwright.config.ts`,
  `studio/e2e/env.ts`, `studio/e2e/helpers.ts`: exit 0.
- The fix is 22 added lines: `NodeSelection` imported, `caretAfterSelectedImage`,
  one call after the insert in `insertImage`, and the reworded comment above
  `filteredPaste` (condition 20). The comment of condition 21 is there. The
  known-id set, `withoutUnknownMediaIds`, `handlePaste`, `handleDrop`, the
  `value` effect and the request are untouched.
- E2's diff: the `Control+End` press removed, the comment corrected,
  `body.focus()` kept, nothing added (condition 18).
- Records (conditions 22 to 26), read in `implementation.md`: section 9 item
  10 has condition 22's words; section 10 has the two round-4 bullets; section
  17 says which evidence is which, marks the superseded sentences, adds the
  coverage row, and ends `Status: READY FOR TEST`.

### 3. The Image button: the reviewer's thirteen probes, and eight of mine

Against the real editor at `2e3f510`, in jsdom. Each: place the caret, click
"Image", choose "Diagram", then one key, "X", put in as a pressed key is
(`handleTextInput`, else `tr.insertText` over the selection; the same way T22
does it). 21 of 21: the selection after the pick is a text selection, never a
node selection, and the new image is there after the key. No paste request.

| # | Caret before the pick | Document after the pick and "X" | Same as the reviewer's "After" |
| --- | --- | --- | --- |
| 1 | End of the only paragraph | "Intro.", image, "X" | Yes |
| 2 | Empty document | image, "X" | Yes |
| 3 | End of a heading, a paragraph follows | "Head", image, "XTail" | Yes |
| 4 | Start of text | image, "XIntro." | Yes |
| 5 | Middle of text | "Int", image, "Xro." | Yes |
| 6 | A range selected | range replaced by the image; "I", image, "Xo." | Yes |
| 7 | End of a list item, another follows | item 1: "one", image; item 2: "Xtwo" | Yes |
| 8 | End of the last list item | item 2: "two", image; then "XTail" | Yes |
| 9 | End of a table cell | cell 1: "c1", image; cell 2: "Xc2" | Yes |
| 10 | End of a blockquote | quote: "quote", image; then "XTail" | Yes |
| 11 | End of text, a stored image follows | "Intro.", Diagram, Chart, "X" | Yes |
| 12 | A stored image selected | stored image replaced by Diagram; "XAfter" | Yes |
| 13 | Inside a code block | block split around the image; "X here" | Yes |
| 14 | End of text; a rule, then text, follow | "Intro.", image, rule, "XTail" | mine |
| 15 | End of text; a table follows | "Intro.", image, table with "Xc1" | mine |
| 16 | End of the only cell of a last table | cell: "c1", image; then "X" | mine |
| 17 | End of text; two stored images follow | caret beyond all three; "X" last | mine |
| 18 | End of text; a code block follows | "Intro.", image, code "Xcode" | mine |
| 19 | An empty paragraph between two paragraphs | "A", image, "XB" | mine |
| 20 | Never focused (the selection the editor starts with) | image first, then "XBefore" | mine |
| 21 | The whole document selected | document replaced by the image, then "X" | mine |

`Validate` accepts the document in every case but 14, where it refuses my own
fixture's rule ("horizontalRule" is not allowed; ADM-22's subject, not this
fix). Cases 12 and 21 replace what was selected when the button was pressed,
as before this change and as the reviewer recorded.

**My own cases that changed (condition 28):**

| Probe | Round 2 | Now |
| --- | --- | --- |
| F1. Image button while a paste answer is out | "Start", image, "Pasted", empty paragraph; image selected before the answer | "Start", image, "Pasted"; a caret before the answer (rule 1, T16's new document) |
| L5 / J3. The same, with a key before and after the answer, then undo and redo | | "Start", image, "kPasted!". Undo steps back to "Start"; redo returns the exact document; `Validate` accepts it |
| J1. Two images picked in a row, then keys | not run | "Intro.", Diagram, Listed, "Tail": both kept. Undo, redo exact |
| J2. A paste straight after the Image button | replaced the new image | Plain text: image kept, text in the line after it. Text with a web image: kept. A crafted image, twice: dropped, nothing sent. A copied library image: kept, **but see finding 1** |
| J4. Image button, then the document is replaced; picker closed with no choice | not run | The key goes into the new document; closing the picker changes nothing and calls `onChange` zero times |
| J5. `StrictMode` | not run | One image per pick; kept after the key |

### 4. Security probes again (the file changed)

All re-run at `2e3f510` against the real filter; all pass, with the same
results as rounds 1 and 2.

| Probe | Result |
| --- | --- |
| S1. Nine crafted `img[mediaid][src]` variants, each twice, then a drop, a paste, a close and reopen, two more pastes | 21 requests; none has the foreign id in any form, `evil.example`, `javascript` or `"src"`. No image node, no `img` element, no `onChange` value with the id. Paste, drop and remount do not seed the set |
| S2. A known id with the page's address and alt | Kept with the page's alt text; no address sent, stored or rendered. The plan's stated worst case |
| S3. An id the picker only listed | Sent as `null`, dropped |
| L4. Crafted paste with a later selection, over a selection, after a remount; eight undos and redos; the document replaced while the answer is out, and replaced and put back | 5 requests, clean. Only the stored image in the editor. Nothing inserted into a replaced document |
| D1. Outside drop: nested image, known id, crafted, `data:` only, text only, a real drop event | Refused with the notice where there is an image node; document unchanged; no request |
| J2 (new). Crafted paste straight after the Image button, twice | Dropped; nothing foreign sent or kept |
| U1, U2, E1, N1, M1, R1 to R8, L1 to L3, L6, F2 | Unchanged from rounds 1 and 2 |

Probe runs: `Tests  1 failed | 73 passed (74)` over five files, then 9 and 10
passed in two follow-up files. The one failure is my probe J2 expecting five
images and finding four; it is not a wrong assertion this time. It is finding 1.

### 5. CI, and what it does and does not show

- **The end-to-end red:** run `42970225620`, job `130356739362`, on `7aece22`:
  `failure` (read again now). E2 at `rich-text.spec.ts:194`, image count 0.
  Seen once; `7aece22` has the same editor as `aef22b5`, where the same job
  passed. It cannot be made to fail on demand.
- **On `2e3f510`:** run `42972617296`, job `130364362542`, "Studio —
  typecheck, build, end-to-end": `completed`, `success`, 06:28:05 to 06:33:35
  UTC.
  ```
   Test Files  11 passed (11)
        Tests  83 passed (83)
    ✓   8 e2e/rich-text.spec.ts:88:1 › ADM-03 rich text: typing after a stored image keeps the image and the text (6.6s)
    ✓   9 e2e/rich-text.spec.ts:162:1 › ADM-03 rich text: an inserted image stays, and a pasted web image is filtered (12.7s)
    30 passed (3.6m)
  ```
  Every other check run on `2e3f510` is `success` (API, Website, website
  browser tests, section comparison, both npm audits, NuGet audit, Semgrep,
  both gitleaks scans, security gate self-test, actionlint); CodeQL and
  screenshot parity `skipped`.
- **What this green run shows:** in Chromium, against the real API, once
  `body.focus()` has put keyboard focus in the editor, keys typed straight
  after the pick, with no `Control+End`, leave the image and land after it;
  the synthetic paste and the real route still work; save and reload keep it.
  Once.
- **What it does not show:**
  - That the intermittent failure is gone. The old code passed this job twice
    and failed once. One green run is the same evidence that let it through.
    Gate 2's three runs in a row (condition 29) are still needed.
  - That staff can pick an image and type with no click: where focus is when
    the picker closes is not exercised (E2 calls `body.focus()`).
  - Anything about a pasted library image and the next key (finding 1). E2
    pastes a web image, which is dropped, and types nothing after the paste.
- **The deterministic proof of the round 4 fix** is T22, T23 and T24, red on
  `10ef86d` and green on `40ad04a` here, and the 21 probes of section 3. There
  is no CI red for E2's new form, and none can exist: commit A fails the
  unit-test step first (condition 30). I agree that is recorded, not waived.
- **A real browser locally:** NOT RUN. No Chromium is installed, and
  `npx playwright install chromium-headless-shell` into the scratchpad failed
  ("Download failure, code=1"). Covered only by CI job `studio`.

### Findings, round 3

**1. Major. A library image that is pasted at the end of the document is left
selected, and the next key deletes it. Cutting an image and pasting it lower
down, then typing, loses the image.**

This is the defect plan round 4 fixes for the Image button, on the paste path,
which round 4 did not touch. It is in this change's own function
(`filteredPaste`), and it is there at `aef22b5` too (same three results), so
rounds 1 and 2 should have found it.

- Steps (probe P10; real editor, real filter): document "Top", stored library
  image, "Middle", "Bottom". Select the image and cut it. Put the caret at the
  end of "Bottom". Paste what was cut. Press one key, "X".
- Expected (plan 3.1 (4): "A library image survives a copy or cut and paste";
  audit Fix 2, "Keep image nodes with a valid `mediaId`"; the audit's title):
  "Top", "Middle", "Bottom", the image, "X".
- Actual: after the paste the document is "Top", "Middle", "Bottom", image,
  empty paragraph, and the selection is a **node selection on the pasted
  image**. After the key: "Top", "Middle", "Bottom", "X". **0 images.** One
  paste request, answered normally; no notice.
- The same with a copy instead of a cut:
  - P1, image alone, caret at the end of the last paragraph: 2 images after
    the paste, selection `node`; 1 after the key.
  - P4, image alone into an empty field (the image known from another field,
    as in T14): 1 image after the paste; 0 after the key.
  - P5, text then image: "BottomPasted", image; the image is gone after the
    key.
  - P9, two images: the second is gone after the key.
- Where it does not happen: when text follows the paste point (P2, P3, P6: a
  caret, both images kept), when the pasted content ends in text (P7), and on
  the late-answer path, rule 3 (P8). So it is the same condition as the Image
  button's: the image ends up last, the editor adds the empty paragraph after
  the selection was chosen, and the selection stays on the image.
- Why: `filteredPaste` dispatches `tr.replaceSelection(piece)` and leaves the
  selection ProseMirror picks, which for a trailing image is the image itself.
  `caretAfterSelectedImage` is called only from `insertImage`.
- T6 and T14 ("pasting a copied library image keeps it", "…copied from another
  rich-text field…") pass because they stop at the paste. Neither presses a
  key, exactly as E2 once pressed `Control+End`.
- Why Major: a library image in rich text is deleted by ordinary typing, with
  nothing to warn the person (the editor draws an image as its alt text), on a
  path this change created and names as working. Gate 1 judged the same
  mechanism after the Image button to be inside ADM-03 and to fail its
  acceptance. This path is less common than insert-then-type, which is why it
  is not a Blocker. One undo brings the image back when the paste and the key
  are more than half a second apart; when they are closer, the first undo
  removes the paste as well.
- Not for me to fix. It needs a red test first that pastes a library image at
  the end of a field and then presses a key (and the cut-and-paste move), and
  it changes what T6 and T14 should go on to assert, so the architect should
  see it.

**2. Minor, carried. The pull request body is still the commit-1 draft text.**
`gh api …/pulls/52 --jq .body` has only "What and why" and the sentence that
the draft "holds only the plan records and the end-to-end red test for now".
No "Behaviour changes for the owner", "For ADM-22" or "For ADM-05"; no caret
item in condition 22's words; run `42970225620` not quoted. The integrator's,
due before gate 2 (conditions 14 and 29; round 1 finding 4).

**3. Observation. Keyboard focus after the picker closes is still unknown.**
Not run in a browser by anyone (plan round 4, "For ADM-22"; my local attempt
failed, section 5). If focus returns to the "Image" button, typing after a
pick does nothing until the person clicks in the editor. That would be a
usability gap for ADM-22, not a lost image.

Rounds 1 and 2: findings 1 to 3 of round 1 stay closed (F1, F2, L1 to L6
re-run). Round 2's findings 5 and 6 are closed by the records at `3a1baa0`
and by this round being on the pushed head.

### Coverage, round 3

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Typing straight after the Image button keeps the image | Audit ADM-03, bullet 3; plan 3.1 (8) | Verified | T22 red at `48f256f`; T16, T22, T23, T24 red at `10ef86d`, green at `40ad04a` and `2e3f510` (section 1); 21 probes (section 3) |
| The caret after the Image button, in every position | `plan-review.md` Round 4, the thirteen probes | Verified | Section 3, rows 1 to 13 match the reviewer's table; rows 14 to 21 |
| An image inserted while a paste is checked is kept; the answer fills the line after it | Plan 3.1 (3) rule 1; T16 | Verified | T16; probes F1, J3 |
| A selection made meanwhile is kept; a paste over a selection replaces it | Plan 3.1 (3) rules 2 and 3 | Verified | T17, T18, T19; probes L1 to L3 re-run |
| **A pasted library image is kept when typing follows** | Plan 3.1 (4); audit Fix 2 | **Failed** | Finding 1: probes P1, P4, P5, P9, P10; the same at `aef22b5` |
| A crafted media id is dropped and never sent; the set is not seeded by paste, drop or remount | Plan section 6; conditions 5, 9 | Verified | T13; probes S1, S2, S3, L4, D1, J2 |
| Notices: this change's two are cleared by a paste that is added | Round 1 finding 2 | Verified | T20, T21; probes F2, L6 re-run |
| A paste answer never lands in a replaced document | T15 | Verified | T15; probes L4, J4 |
| The second host; nested images; Markdown pattern; undo and redo | Rounds 1 and 2 | Verified again | Probes E1, N1, M1, U1, U2, J1, J3 |
| E2 without `Control+End` | Plan round 4; condition 18 | Verified in CI once; NOT RUN locally | Run `42972617296`, job `130364362542`; what it shows and does not: section 5 |
| The intermittent E2 failure is gone | Condition 29 | Not shown by one run | Gate 2's three runs in a row |
| `tsc -b`, `npm test`, build, lockfile | Conditions 18, 19 | Verified | Section 1 |
| Scope: `40ad04a` touches only `RichTextEditor.tsx`; no package, config, API or workflow change | Conditions 11, 19 | Verified | Section 2 |
| Records for round 4 (conditions 20 to 26) | `plan-approval.md` | Verified | Section 2 |
| Pull request body | Conditions 14, 29 | Open, integrator | Finding 2 |
| Keyboard focus after the picker closes | Plan round 4, "For ADM-22" | NOT RUN in a browser | Finding 3 |

Round 4's fix does what the plan says, every planned check passes, and the
security probes are clean. The verdict is for finding 1: this change still
deletes a library image on the next key, by the paste path instead of the
button.

Round 3 result: CHANGES NEEDED (one Major: finding 1).

## Round 4

Tester and security engineer, 11 November 2026. A full round, as condition 43
of `plan-approval.md` ("Gate 1 again: plan round 6") asks.

- **Commit tested:** `c1df803` (`c1df80334dfa…`), the pushed head of
  `change/ADM-03`; still the remote head when I finished. New since round 3's
  head `2e3f510`, outside records: `a2a0852` (tests only: T6 and T14 extended,
  T25 to T32, one E2 step), `93ab48f` (fix, `RichTextEditor.tsx` only),
  `c1df803` (`implementation.md` section 18).
- **Where:** a fresh detached worktree, `/home/user/dh-test-adm03`, removed at
  the end. No commit, push, rebase or amend; no port; no database; no source,
  test, lockfile or workflow changed. This section is the only thing written.
- **Read:** `plan.md` 3.1 item 9 and section 5.6, `plan-review.md` Rounds 5 and
  6, `plan-approval.md` "Gate 1 again: plan round 6" (conditions 31 to 46),
  `implementation.md` section 18.

### 1. Red, then green

Setup: `npm ci` exit 0, `found 0 vulnerabilities`;
`git diff --exit-code -- studio/package-lock.json studio/package.json` exit 0.

**Red, on a checkout of `a2a0852`** (the editor is still `40ad04a`'s):

```
$ npx tsc -b; echo $?
0
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 failed (1)
      Tests  8 failed | 23 passed (31)
1
$ npm test
 Test Files  1 failed | 10 passed (11)
      Tests  8 failed | 83 passed (91)
```

| Id | Test | Message | Line |
| --- | --- | --- | --- |
| T6 | pasting a copied library image keeps it | `expected 'node' to be 'text'` | 342 |
| T14 | a library image copied from another rich-text field on the page is kept | `expected 'node' to be 'text'` | 494 |
| T25 | text and a library image pasted at the end are kept when typing follows | `expected 'node' to be 'text'` | 705 |
| T26 | an image cut and pasted at the end is kept when typing follows, and undo takes back only the typing | `expected 'node' to be 'text'` | 725 |
| T27 | a library image pasted into an empty field is kept when typing follows | `expected 'node' to be 'text'` | 754 |
| T28 | two library images pasted at the end are both kept when typing follows | `expected 'node' to be 'text'` | 768 |
| T29 | a late paste answer that ends in an image keeps it when typing follows | `expected 'node' to be 'text'` | 784 |
| T32 | redoing a pasted image does not leave it selected | `expected 'node' to be 'text'` | 867 |

- The eight and only the eight; T30 and T31 pass as guards with the 21 other
  tests. No "is not a function" or "is not defined" line.
- **All eight stop at the selection-type assertion, before the key.** So the
  red shows "the image is left selected", not "the image is deleted". That the
  key deletes it is shown by my round 3 probes P1, P4, P5, P9 and P10 on the
  old code, and that it no longer does is shown by the same probes below, not
  by the red run.
- The test file's diff against `2e3f510` removes no line. T6 and T14 only gain
  lines after their old assertions; a helper is added to `mount`; T25 to T32
  are appended. The fake filter is unchanged since `da940bb`.

**Green, on a checkout of `93ab48f`, and again on `c1df803`** (same on both):

```
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 passed (1)
      Tests  31 passed (31)
0
$ npm test; echo $?
 Test Files  11 passed (11)
      Tests  91 passed (91)
0
$ npx tsc -b; echo $?
0
$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build; echo $?
✓ built in 1.01s            (995ms on c1df803)
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
0
$ git status --short            (prints nothing)
$ git diff --exit-code -- studio/package-lock.json studio/package.json; echo $?
0
$ npm audit --audit-level=high
found 0 vulnerabilities
```

The 31 tests also pass with the fake swapped for the real
`RichText.FilterPaste` (scratch console, rebuilt from this commit's
`RichText.cs`).

### 2. Scope

| Commit | Files |
| --- | --- |
| `a2a0852` | `studio/test/richText.test.tsx`, `studio/e2e/rich-text.spec.ts` |
| `93ab48f` | `studio/src/content/RichTextEditor.tsx` |
| `c1df803` | `docs/changes/ADM-03/implementation.md` |

- The whole branch (`77296ba..c1df803`), outside `docs/changes/ADM-03/`, still
  changes four files: the editor, the render test, its fake, the e2e spec.
  `git diff --quiet 77296ba c1df803 --` over the package files,
  `MediaPicker.tsx`, `api`, `website`, `packages`, `.github`, the `tsconfig`,
  Vitest and Playwright configs, `e2e/env.ts` and `e2e/helpers.ts`: exit 0.
- The fix is 13 added and 6 removed lines: one call,
  `caretAfterSelectedImage(view)`, straight after `filteredPaste`'s one
  dispatch, with its comment; and the helper's header comment reworded. The
  helper's body is unchanged. `grep -n caretAfterSelectedImage`: the definition
  (109) and two call sites (263, 366). No `onCreate`, nothing in or after the
  `value` effect. Condition 36 is met.
- E2's diff is the one step of plan 5.6 and the two counts that follow from it
  (`toHaveCount(2)` after the reload). No wait, retry, `Control+End` or extra
  focus call (condition 32).

### 3. The paste probes again: P1 to P10, at `c1df803`

Real editor, real filter. Each: paste, read the selection, press one key ("X",
put in as a pressed key is), count the images.

| Probe | Round 3 (`2e3f510`) | Now |
| --- | --- | --- |
| P1. Image alone, caret at the end of the last paragraph | selection `node`; 2 images, then 1 | `text`; 2, then 2; "Bottom", image, "X" |
| P2. Image alone, end of a middle paragraph | `text`; kept | same: "Middle", image, "XBottom" |
| P3. Image alone, middle of a word | `text`; kept | same |
| P4. Image alone, into an empty field | `node`; 1, then 0 | `text`; 1, then 1; image, "X" |
| P5. Text then image, at the end | `node`; image lost | `text`; "BottomPasted", image, "X" |
| P6. Text then image, end of a middle paragraph | `text`; kept | same |
| P7. Image then text, at the end | `text`; kept | same |
| P8. Late answer after another selection (rule 3) | `text`; kept | same |
| P9. Two images at the end | `node`; the second lost | `text`; 3 images, then 3; "X" after both |
| P10. Cut the image, paste it at the end, press a key, undo | `node`; 0 images after the key | `text`; 1 image; "Top", "Middle", "Bottom", image, "X". One undo removes only the "X"; 1 image. One paste request |

**So the image survives the key after the fix, in every case where it was lost
before.** That is the thing the red run alone does not show.

### 4. The sweep, done independently

Forty cases of my own (W01 to W40), real editor, real filter, each ending in
one pressed key, with the selection type read first. "Lost" means fewer images
after the key than before it.

| Group | Cases | Result |
| --- | --- | --- |
| **Rule 2, a paste over a selection, ending in an image** (the row the developer said was untested) | W01 over a text range at the end; W02, W03 over the whole document (image alone; text then image); W04 over the selected stored image when it is last; W05 the same with text following; W06 over a range in the only cell of a table | All six: selection `text` before the key; nothing lost. E.g. W03: "Pasted", image, "X" |
| Rule 1 inside structures (the reviewer's list and table rows) | W07 end of the last item of a last list; W08 end of an item with another after it; W09 end of a table cell with another after it; W10 end of the last cell of a last table; W11 end of a last blockquote; W15 inside a last code block | All `text`; nothing lost. The caret goes to the trailing line (W07, W10, W11, W15) or to the start of the next item or cell ("Xtwo", "Xc2"), as the owner's sentence in section 9 says |
| Pasted content that itself ends in an image inside a structure | W12 a pasted list whose last item ends in the image; W13 a pasted table whose last cell does; W16 a known image then a dropped web image | All `text`; nothing lost |
| Rule 3, the late answer (the architect's L2) | W18 the stored last image selected meanwhile; W19 a range in the last paragraph selected meanwhile; W20 the whole document selected, two images; W21 two pastes answered in the other order | All `text`; nothing lost |
| Undo and redo (the architect's U1) | W22, W23 Image button, undo, redo (end of text; empty field); W24 paste, type, undo the typing; W25 rule 2 paste, undo, redo; W26 cut-and-paste move, undo twice, redo twice; W27 rule 3 paste, undo, redo | All `text`; nothing lost. The Image-button redo is not in the plan's table; it is safe |
| Toolbar and the two paths mixed | W34 Image button then Bold; W35, W36 paste an image then the List or Table button; W37 paste an image then the Image button; W38 Image button then paste an image | All `text`; nothing lost. W37: "Bottom", pasted image, picked image, "X" |
| Load, text first | W33 | `text`; kept |
| **Load, image first (M1)** | W31 image, "Mid", image: `focus()`, key; W32 an image alone | Selection `node`; **the first image is deleted by the key.** Unchanged, as plan round 6 says it would be. This is the known limit of condition 38, **recorded here as a known limit and not as a pass** |
| **The `value` effect** | W28 the host replaces the value with image, "Mid", image; W29 with an image alone; W30 a stored value that is not in the editor's own shape and starts with an image (the effect runs at mount) | Selection `node`; **the first image is deleted by the key.** Finding 1 below: plan 5.6's table says "Not seen" |
| The person's own selection | W39 the stored last image selected, then a paste whose check fails; W40 the same, pasting only a web image (nothing is added) | The image stays selected, as the person left it, and a key replaces it. Not this change's selection |
| A stored image last, then `focus("end")` and a paste (W14); an image-only document, paste with the load selection (W17) | | The paste replaces the selected image (rule 2); one image, caret after it. The M1 family: the selection came from the start or end of the document, not from this change |

Found in the sweep and missing from, or wrong in, plan 5.6's table: one row,
the `value` effect (finding 1). Nothing else. In particular I found no path
through `insertImage` or `filteredPaste` that leaves an image selected.

Also re-run and unchanged: the 21 Image-button cases of round 3 (I 01 to 21),
J1 to J5, F1, F2, L1 to L6, U1, U2, N1, M1 (Markdown), R1 to R8, E1.

### 5. Opening changes nothing; a paste is one change

**Opening (probe O1),** ten stored documents, each mounted plain and in
`StrictMode`, read after two settles with nothing done:

| Stored document | `onChange` calls | `can().undo()` | Editor document equals the stored one |
| --- | --- | --- | --- |
| image, "Mid", image | 0 | false | yes |
| an image alone | 0 | false | yes (one node: no paragraph was added) |
| image, bullet list | 0 | false | yes |
| text, image last | 0 | false | yes |
| a table last | 0 | false | yes |
| an image in a last list item | 0 | false | yes |
| a code block last | 0 | false | yes |
| text only | 0 | false | yes |
| two images only | 0 | false | yes |
| the empty string | 0 | **true** | yes |

- Then the host replaces the value: `onChange` still 0 in all twenty runs.
- `onChange` is never called by opening or by a replacement. T30's rule holds
  on more documents than T30 uses, and in `StrictMode`.
- The one `true`: an empty field has an undo step at open, because the `value`
  effect runs `setContent` when the value is `""`. That effect's guard and call
  are the same at the base `77296ba`; this change did not make it. For ADM-22,
  not a finding here.

**A filtered paste (probe O2):**

| Paste | `onChange` calls | Undo steps back to the stored document |
| --- | --- | --- |
| Image at the end (the helper moves the caret) | 1 | 1 |
| Text and image at the end | 1 | 1 |
| Image in the middle (the helper does nothing) | 1 | 1 |
| Text and a web image at the end | 1 | 1 |
| A web image only (nothing added) | 0 | 0 |
| Late answer, rule 3, ending in an image | 1 | 1 |
| A plain paste, not filtered (for comparison) | 1 | 1 |

The helper's selection-only dispatch adds no `onChange` call and no undo step.

### 6. Security probes again (the file changed)

All at `c1df803`, real filter; all as in rounds 1 to 3.

| Probe | Result |
| --- | --- |
| S1. Nine crafted `img[mediaid][src]` variants, each twice; a drop; a paste; close and reopen; two more pastes | 21 requests; none has the foreign id in any form, `evil.example`, `javascript` or `"src"`. No image node, no `img` element. Paste, drop and remount do not seed the set |
| S2. A known id with the page's own address and alt | Kept with the page's alt text; no address sent, stored or rendered (the plan's stated worst case) |
| S3. An id the picker only listed | Sent as `null`, dropped |
| L4. Crafted paste with a later selection, over a selection, after a remount; undo and redo; the document replaced, and replaced and put back, while the answer is out | 5 requests, clean; only the stored image in the editor; nothing inserted into a replaced document |
| D1. Outside drop: nested image, known id, crafted, `data:` only, text only, a real drop event | Refused with the notice where there is an image node; document unchanged; no request |
| J2. After the Image button: a plain paste, a web-image paste, a copied library image, a crafted image twice | 5 images, all known ids (round 3 had 4: the copied image had replaced the picked one). Nothing foreign sent or kept; `Validate` accepts the document |

The new call only sets a selection. It reads no pasted content and adds
nothing to the set of known ids.

Probe runs: 144 tests over eight files; 137 passed. The 7 that failed were my
own harness (two editors mounted, so "the Image button" matched two buttons);
scoped to the editor under test and re-run: 7 passed. Nothing in the editor
failed.

### 7. CI, and what it does and does not show

- **On `c1df803`:** run `42976109409`, attempt 1, job `130375585045`, "Studio —
  typecheck, build, end-to-end": `completed`, `success`, 06:58:39 to 07:04:15
  UTC.
  ```
   Test Files  11 passed (11)
        Tests  91 passed (91)
    ✓   8 e2e/rich-text.spec.ts:88:1 › ADM-03 rich text: typing after a stored image keeps the image and the text (6.7s)
    ✓   9 e2e/rich-text.spec.ts:162:1 › ADM-03 rich text: an inserted image stays, and a pasted web image is filtered (10.2s)
    30 passed (3.6m)
  ```
  Every other check run on `c1df803` is `success` (API, Website, website
  browser tests, section comparison, both npm audits, NuGet audit, Semgrep,
  both gitleaks scans, security gate self-test, actionlint); CodeQL and
  screenshot parity `skipped`.
- **What it shows:** in Chromium, against the real API and the real paste
  route, a library image pasted as the editor's own HTML is kept (two images,
  two paste requests), real keys typed straight after it leave both images and
  the text, and a save and reload keep both. It also repeats round 3's result
  for the Image button with no `Control+End`. Once.
- **What it does not show:**
  - That an intermittent failure is gone. This is one attempt. Gate 2's three
    completed `success` attempts on the final `studio/` tree (condition 44)
    are still to come.
  - A red for the new E2 step. None exists and none can: on `a2a0852` CI stops
    at the unit tests.
  - The paste at the very end of an otherwise empty line with the image last
    in the document in every form: E2 pastes after typed text, one case. The
    other cases are T25 to T29, T32 and section 4.
  - The load case (M1), or where keyboard focus is when the picker closes.
    Neither has been run in a browser by anyone. I have no Chromium here (the
    download failed in round 3).
- **Deterministic evidence for this round's fix:** T6, T14, T25 to T29 and T32,
  red on `a2a0852` and green on `93ab48f`; and probes P1, P4, P5, P9, P10 and
  W01 to W27, which show the image after the key.

### Findings, round 4

No Blocker. No Major. Round 3's finding 1 (Major) is closed.

**1. Minor. The `value` effect can leave an image selected; plan 5.6's sweep
table and `implementation.md` section 18 say "Not seen".**

- Steps (probe W28): a field holding "Old". The host replaces the value with
  image, "Mid", image, as opening another item in the same editor does. Press
  one key.
- Expected, from the table's row "The `value` effect (`setContent`) | Not seen:
  … gave a text selection after a replacement": a caret.
- Actual: the selection is a node selection on the first image; the key
  deletes it ("X", "Mid", image). W29, an image alone: 0 images after the key.
  W30, a stored value that is not in the editor's own shape (here, an image
  with no `decorative` key) and starts with an image: the effect runs at mount,
  and the result is the same. In probe O1 the selection was `node` after every
  replacement by an image-first document, twenty runs of twenty.
- It is the load case again by a second door: ProseMirror puts the selection
  at the start, and the start is an image. `setContent` in that effect is not
  new in this change, the document must begin with an image, and before ADM-03
  that image was deleted by any key. So it is the same known limit, not a new
  defect, and I do not ask for a fix here.
- What is wrong is the record. The sweep is the thing gate 1 leaned on ("This
  time there is a sweep"), and one of its rows is not true. The "Known limit"
  paragraph for the owner says a field that begins with an image "opens with
  that image selected"; it should also cover a field whose content is replaced
  while it is open. The table row and the ADM-22 entry should say "Yes: the
  same as editor creation, when the new document starts with an image".

**2. Minor, carried since round 1. The pull request body is still the commit-1
draft text.** Only "What and why". The integrator's; gate 2 will not read it
until it is rewritten (condition 45).

**3. Observations, not findings.**

- An empty field has an undo step when it opens (section 5). Older than this
  change. For ADM-22.
- After the Image button or a paste, the caret is at the start of the line
  after the image. Backspace there selects the image, as it does in any
  ProseMirror editor, and the next key or Backspace removes it. That is the
  person's own key, like a click on the image; with the picture not drawn
  (ADM-22) there is little to show that the image is selected.
- The load case and keyboard focus after the picker closes are NOT RUN in a
  browser.

### Coverage, round 4

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A pasted or moved library image is kept when typing follows | Plan 3.1 (9); audit Fix 2; round 3 finding 1 | Verified | T6, T14, T25 to T29, T32 red at `a2a0852`, green at `93ab48f` and `c1df803`; the image after the key: probes P1 to P10 (section 3) |
| The same for a paste over a selection (rule 2) | `implementation.md` section 18, the untested row | Verified | Probes W01 to W06, W25 |
| The same in lists, tables, blockquotes and code blocks | `plan-review.md`, the list and table rows | Verified | Probes W07 to W13, W15 |
| The same for the late answer, and after undo and redo | Plan 5.6, L2 and U1 | Verified | T29, T32; probes W18 to W27 |
| No path through `insertImage` or `filteredPaste` leaves an image selected | Condition 43, the sweep | Verified | Section 4: 32 cases through those two functions (W01 to W27, W34 to W38), none lost; P1 to P10 |
| The sweep table is complete and true | Plan 5.6; condition 39 | One row wrong | Finding 1 (the `value` effect) |
| Opening an item changes nothing | Plan 3.1 (9) round 6; T30 | Verified | T30; probe O1: `onChange` 0 on ten documents, plain and `StrictMode`, and after a replacement |
| A filtered paste is one `onChange` call and one undo step | Condition 43 | Verified | Probe O2 |
| A field that begins with an image opens with it selected (M1) | Plan 5.6; condition 38 | **Known limit, not fixed, not a pass.** Moved to ADM-22 | Probes W31, W32: the image is deleted by the first key after `focus()`. Not run in a browser |
| Typing straight after the Image button keeps the image | Round 3 | Verified again | T22 to T24; the 21 probes of round 3 re-run; W22, W23, W34, W37, W38 |
| A crafted media id is dropped and never sent; the set is not seeded | Plan section 6 | Verified | T13; probes S1, S2, S3, L4, D1, J2 |
| A paste answer never lands in a replaced document | T15 | Verified | T15; probe L4 |
| E2 with the pasted library image and real keys | Plan 5.6 | Verified in CI once; NOT RUN locally | Run `42976109409`, attempt 1, job `130375585045` (section 7) |
| The Studio job green three times in a row | Condition 44 | Not yet: one attempt | Gate 2 |
| `tsc -b`, `npm test`, build, lockfile | Conditions 33, 36 | Verified | Section 1 |
| Scope: `93ab48f` touches only `RichTextEditor.tsx`; one call added | Condition 36 | Verified | Section 2 |
| Pull request body | Condition 45 | Open, integrator | Finding 2 |

Every planned check passes, the images lost in round 3 are kept after the key,
and the sweep found no other path through this change's own code. The two
Minors are records: one row of the sweep table and the owner's known-limit
wording, and the pull request body. The load case stays a known limit that the
owner must read before merging.

Verdict: APPROVED
