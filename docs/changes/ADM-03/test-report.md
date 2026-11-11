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

Verdict: APPROVED
