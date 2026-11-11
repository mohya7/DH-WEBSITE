# ADM-02: plan

Change id: `ADM-02`. Branch: `change/ADM-02`, worktree `/home/user/dh-change-adm02`,
cut from `origin/rebuild/dotnet-platform` at `77296ba`.
Architect, round 1, 11 November 2026.

**One change. It also closes two of ADM-07's three parts.** ADM-07's first two
parts (a trailing slash takes over a live page; `/a → /a/` loops) are the same
comparison in the same functions, so they are fixed here. ADM-07's third part
(a target that does not exist), its Studio warning, its build report and its
end-to-end test stay in a separate change, ADM-07, which comes next (3.4 says
why). "Report a failed build in the Studio" goes to ADM-01a (3.5).

## 1. Item

- **Closes:** ADM-02, "content the API accepts can stop every website build, and
  nobody in the Studio is told", `docs/quality/admin-audit-2026-10-28.md`
  (Blockers). The fourth part of its fix ("Report a failed build in the Studio")
  moves to ADM-01a. It feeds FR-S-11 in that audit's requirement table: "Partly |
  Can break the build, take over a page, or loop (ADM-02, ADM-07)".
- **Also closes, in part:** ADM-07 (Major), parts 1 and 2. Part 3 goes to the
  ADM-07 change (section 4, "Out of scope").
- **Track:** G3, batch G3-1 (Blockers), slot 2, 3 to 16 November. The batch row
  in the refinement plan names "ADM-02 and ADM-07 redirect and schema checks".
  The order is "ADM-06, 03, 02, 07, 10, 05, 04, 12, 01a" (refinement plan,
  Execution order, step 2). ADM-06 merged (#49, #51). ADM-03 is open as #52.
- **Owner's request:** none quoted for ADM-02 in this session. The coordinator
  assigned ADM-02 as the next G3-1 item. No owner words are assumed.
- **Done when**, quoted from the audit:
  > **ADM-02: content the API accepts can stop every website build, and nobody in the
  > Studio is told.**
  > - Redirects `/x/` and `/x` are both accepted (201). The build then fails with
  >   "Two redirects start at /x/".
  >   - The API compares exact strings (`AdminStore.cs:139`).
  >   - The build ignores a trailing slash (`website/src/iis/web-config.ts:148`).
  > - A section reference id that is not a UUID was accepted and published. The build
  >   rejects it (`format: "uuid"`), because the API does not enforce schema formats
  >   the build enforces.
  > - Fix:
  >   - Normalise paths in every redirect check.
  >   - Enforce the same formats in the API.
  >   - Add a test that feeds API-accepted content to the website's checks.
  >   - Report a failed build in the Studio (ADM-01a).
- **The ADM-07 text this change answers in part**, quoted from the audit:
  > **ADM-07: a manual redirect can take over a live page or loop.**
  > - `/blogs/<live-slug>/` is accepted and emitted ahead of the clean-URL rule, so the
  >   live page returns 301.
  > - `/a → /a/` is accepted: its pattern matches its own target.
  > - A target that does not exist is accepted and built (Phase C 10.7 "every redirect
  >   resolves" is not enforced).
  > - Same root cause as ADM-02. Fix it with path normalisation, plus a target check
  >   that warns in the Studio and reports in the build.
- **Batch exit gate**, quoted from the refinement plan, Track G3:
  > A clean website build from `DigitalHubContent_Studio` with no patched content;
  > each blocker reproduced before its fix and passing after it
- **Success measure** this moves (refinement plan): "Website builds from Studio
  content that need patching first | Every build (error pages, redirects, schema
  formats) | 0 | 16 Nov". ADM-02 removes the redirects and schema-formats causes
  for new content. Existing rows need O-ADM02-2. Error pages are ADM-05.
- **Design this must keep:**
  - `docs/phase-b-studio.md` 4.4: "Slugs ... never equal to the source of an
    active redirect." 4.5: "Chains collapse ... A redirect that would create a
    loop is refused." 8.3: "Redirects: list, add, remove. The same chain and loop
    rules as 4.5." Line 158: "A new path that is already a redirect source is
    refused on save and on publish."
  - `CLAUDE.md`, Settled design: "Save is not publish. References are { type, id }."

### Required reading

| Document | Where read | Present |
| --- | --- | --- |
| `docs/changes/README.md`, `.claude/agents/architect.md`, `AGENTS.md`, `CLAUDE.md` | worktree | Yes |
| `ENGINEERING_STANDARDS.md` | `git show origin/claude/cool-heisenberg-mh6zx9:ENGINEERING_STANDARDS.md` | Yes, not on the base |
| `docs/PROJECT_PROFILE.md`, `docs/deferred-items.md` ("No entries yet.") | same branch, `git show` | Yes, not on the base |
| `docs/quality/refinement-plan-2026-10-28.md`, `docs/quality/admin-audit-2026-10-28.md` | `/mnt/project-files/docs/quality/` | Yes, not in the worktree |
| `docs/changes/ADM-06/plan.md`, ADM-03 plan (`git -C /home/user/dh-change-adm03 show HEAD:docs/changes/ADM-03/plan.md`) | worktree; ADM-03 read only | Yes (format models) |
| `docs/phase-b-studio.md`, `docs/phase-c-website.md` (10.7), `docs/business-analysis.md` (FR-S-11) | worktree | Yes |
| `docs/adr/0001-split-public-forms-api.md` | not needed (G2 only); `docs/adr/` is not on the base | n/a |

There is no `plan-review.md`, `plan-approval.md` or `implementation.md` for
ADM-02 yet. This is round 1.

Rules that apply: P-4 (failing test first), P-5 (fail closed), P-6, P-7, P-8,
B-6 (red test committed before the fix), B-7, B-8 (one topic), A-5 ("Every body
is validated before work").

## 2. Current state

### 2.1 The base

```
$ git -C /home/user/dh-change-adm02 log --oneline -3
77296ba ADM-06b: Add paging controls to the Studio's long lists (#51)
1f53484 ADM-06: Bind PageQuery from the query root (ADM-06a) (#49)
3e1fc47 semgrep-timeout: Give each Semgrep rule 30 seconds per file (#50)
$ git -C /home/user/dh-change-adm02 status
On branch change/ADM-02
nothing to commit, working tree clean
```

Open pull requests and their files (`gh api repos/{owner}/{repo}/pulls/<n>/files`):

- #52 (ADM-03): `studio/e2e/rich-text.spec.ts`, `studio/src/content/RichTextEditor.tsx`,
  `studio/test/richText.test.tsx`, `studio/test/support/pasteFilter.ts`,
  `docs/changes/ADM-03/*`.
- #44 (GAP-07): `.github/security/*`, `.github/workflows/security.yml`,
  `docs/changes/GAP-07/*`.

No file in section 4 is in either. This plan changes no Studio file at all.

### 2.2 Redirects: how the build keys them, and how the API compares them

**The website build** (`website/src/iis/web-config.ts`):

- Line 118, `assertPath`: the same character rule the API has (`RedirectPaths.cs`,
  locked together by `RedirectPathRuleTests.The_api_rule_is_the_website_builds_rule`).
  `//` is refused, so a valid path has at most one trailing slash.
- Line 127, `matchPattern`: `fromPath.slice(1).replace(/\/+$/, "")`, then
  `^<body>/?$`. So `/x` and `/x/` produce the same rule, which matches both
  addresses.
- Line 148, `redirectRules`: `const key = row.fromPath.replace(/\/+$/, "") || "/";`
  and line 149 throws `Two redirects start at ${row.fromPath}.` on a repeated key.
- The redirect rules are written before the clean-URL rule (line 159, and the
  header comment: "Rules run before the clean-URL rewrite").

**The API** (`api/src/DigitalHub.Api/Content/AdminStore.cs`) compares exact strings
everywhere. The audit cites line 139; the duplicate check is at line 140 on this
base.

| Where | Line | Comparison today | What slips through |
| --- | --- | --- | --- |
| `CreateRedirectAsync`, self-redirect | 137 | `from == to` | `/a → /a/` (ADM-07 part 2) |
| `CreateRedirectAsync`, duplicate | 140 | `redirect.FromPath == from` | `/x` then `/x/` (ADM-02 part 1) |
| `OccupiesLivePathAsync` | 601-644 | `ContentPaths.PublicPath(...) == fromPath` | `/blogs/<live>/` (ADM-07 part 1) |
| `ResolveDestinationAsync` | 646-659 | `HashSet` of exact strings; lookup `FromPath == current`; loop when `current == from` | `/q/ → /p/` when `/p → /q` exists: a loop the build emits |
| `CheckRedirectAsync` (the content-bundle import's check) | 864-883 | same as above, and no duplicate check at all ("other than that it already exists") | an imported `/x` and `/x/` pair |

**The API** (`api/src/DigitalHub.Api/Content/ContentStore.cs`):

| Where | Line | Comparison today | What slips through |
| --- | --- | --- | --- |
| `CheckAsync`, "That address is the source of a redirect." | 740-742 | `redirect.FromPath == path` | publishing page `s` while a redirect starts at `/s/`: the redirect then takes over the new live page |
| `RetargetAsync`, the redirect that starts at the old address | 1047-1092 | `FromPath == oldPath` | a stored `/s/` is missed, so a second row `/s` is created: two rows with one address, and the build fails |
| `DeleteAsync` and `RetargetAsync`, redirects that point at an item | 247-251, 1054-1068 | `ToPath == path` | a redirect to `/s/` is not removed or retargeted: its target no longer exists. This is ADM-07 part 3 (section 4, "Out of scope") |

The column has a unique index (`ContentModelBuilder.cs:104`,
`IX_redirects_from_path`) and the default case-insensitive collation, so `/X` and
`/x` already collide in the database. The build keys are case-sensitive. The API
is stricter there, which can never break a build. That stays.

**Reproduced, website side.** I copied `web-config.ts` and `design/sets.ts` into
the scratchpad (the only edit: the import gets a `.ts` extension) and ran it with
Node 22.23.4:

```
$ node repro.mts
A /x and /x/  : THROWS Two redirects start at /x/.
B /a -> /a/   : OK ["/a match=^a/?$ -> /a/"]
C /blogs/s/   : OK ["/blogs/live-slug/ match=^blogs/live-slug/?$ -> /"]
```

- A is ADM-02 part 1: the build stops.
- B is ADM-07 part 2: the rule matches its own target, so `/a` redirects to `/a/`,
  which redirects to `/a/` for ever.
- C is ADM-07 part 1: the rule runs before the clean-URL rule, so the live page
  answers 301.

**Not reproduced, API side: NOT RUN.** The API side needs SQL Server, and there is
none in this container. The table above is from reading the code. The audit's
own run reproduced it ("Redirects `/x/` and `/x` are both accepted (201)").
Sections 5.1 and 5.4 show it red in CI.

### 2.3 Schema formats: the build asserts them, the API does not

**The website build** (`website/src/content/validate.ts`):

- Line 61: `new Ajv2020({ allErrors: true, strict: true })`. Under `strict` an
  unknown format is a compile error, so every format used must be registered.
- Line 71: `ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);`
  It is the only format registered, in `newAjv`, which builds both the section and
  the collection validators.
- `validateContent` stops the build on any problem (`prepare.ts`, `ContentCheckError`).

**The schemas.** `format` appears three times, always `"uuid"`:

```
$ grep -rhoE '"format": *"[a-z-]+"' packages | sort | uniq -c
      3 "format": "uuid"
```

- `packages/sections/defs.json`, `$defs/media.mediaId` and `$defs/reference.id`.
- `packages/sections/related_items.json`, `items[].id`.
- Through `$defs/reference`: `blog_list`, `case_cards`, `hero`, `partner_grid`,
  `service_cards`. Through `$defs/media`: ten section types.
- No collection schema uses `format`.

**The API** (`SectionSchemaSet.cs:34`, `CollectionSchemaSet.cs:36`):
`new EvaluationOptions { OutputFormat = OutputFormat.List }`, Draft 2020-12, with
JsonSchema.Net 8.0.5 (`DigitalHub.Api.csproj:20`). In 2020-12, `format` is an
annotation unless format assertion is switched on, so the API never checks it.

**Reproduced, DB-free.** Release build of `api/src/DigitalHub.Api` at `77296ba`
(`0 Warning(s)`, `0 Error(s)`). A scratchpad console referenced that DLL and called
the real `SectionSchemaSet.Validate("case_cards", ...)` with
`items[0].reference = { type: "case_study", id }`:

```
case_cards reference.id=not-a-uuid                           errors=0
case_cards reference.id=0123456789abcdef0123456789abcdef     errors=0
case_cards reference.id=01234567-89ab-cdef-0123-456789abcdef errors=0
```

The website's verdict on the same values (`node -e` with the line-71 expression):
`not-a-uuid` false, the 32-digit form false.

**Why "not a UUID" also gets past publish.** `PublishChecks.cs:237-252` and
`BuildContentStore.cs:213-220` find references with `Guid.TryParse`. That fails for
`not-a-uuid` and `""`, so the reference is skipped: no error, no warning, not even
an unresolved reference. It succeeds for `0123456789abcdef0123456789abcdef`,
`{01234567-...}` and `(…)`, so those resolve and publish, and the website then
refuses them. `MediaUsage.ReferencedIds` (`MediaUsage.cs:126-135`) also uses
`Guid.TryParse`, so a `mediaId` of `not-a-uuid` is never checked against the
library either.

**The Studio sends empty ids today** (added from reading the Studio, not the audit):

- `studio/src/content/FormWalker.tsx:240,263`: changing a reference's type sends
  `{ type, id: "" }` until an item is picked.
- `FormWalker.tsx:171,176-179`: typing alt text or ticking Decorative before an
  image is chosen sends `{ mediaId: "", alt, decorative }`.

Both save (200) and publish (200) today, and then stop the website build:
`""` fails `format: "uuid"`. So a normal Studio flow reaches ADM-02, not only a
hand-made API call. Section 3.2 says why the fix applies at publish and not at
save.

**JsonSchema.Net's own `uuid` is not the website's.** A scratchpad probe of
JsonSchema.Net 8.0.5:

```
"not-a-uuid"                               default=True requireFormat=False Guid.TryParse=False
"0123456789abcdef0123456789abcdef"         default=True requireFormat=False Guid.TryParse=True
"{01234567-89ab-cdef-0123-456789abcdef}"   default=True requireFormat=False Guid.TryParse=True
"01234567-89AB-CDEF-0123-456789ABCDEF"     default=True requireFormat=True Guid.TryParse=True
"01234567-89ab-cdef-0123-456789abcdef"     default=True requireFormat=True Guid.TryParse=True
"01234567-89ab-cdef-0123-456789abcdeg"     default=True requireFormat=False Guid.TryParse=False
" 01234567-89ab-cdef-0123-456789abcdef"    default=True requireFormat=True Guid.TryParse=True
```

With assertion on, the library accepts a leading space, which the website refuses.
So switching assertion on is not enough. The API must register the website's
pattern. A per-options registry works and leaves the global one alone:

```
"not-a-uuid"                                 custom=False global.Uuid.unchanged=True
" 01234567-89ab-cdef-0123-456789abcdef"      custom=False global.Uuid.unchanged=True
"01234567-89ab-cdef-0123-456789abcdef\n"     custom=True global.Uuid.unchanged=True
  msg: /id format: Value is not a match for the format 'uuid'.
```

The last case shows a .NET trap: `$` matches before a final newline, even with
`RegexOptions.ECMAScript`. JavaScript's `$` does not:

```
"01234567-89ab-cdef-0123-456789abcdef\n"         ecma=True plain=True az=False   (.NET)
"01234567-89ab-cdef-0123-456789abcdef\n"         website=false                    (Node)
```

So the API pattern must end in `\z` (the `az` column), not `$`.

### 2.4 Tests and harness

- `RedirectPathRuleTests.cs` reads `web-config.ts` and locks the character rule.
  Nothing locks the trailing-slash key or the `uuid` format.
- Existing redirect behaviour tests: `AdminApiTests.Redirect_refuses_loops_collapses_chains_and_blocks_live_paths`
  (232-285), `ContentPublishTests.Publish_refuses_a_rename_that_would_loop` (241-286),
  `ContentPublishTests.Slug_cannot_match_a_redirect_source` (288-).
  `ListPagingTests` and `studio/e2e/paging.spec.ts` create plain redirects to `/`.
  None uses a trailing slash, so none changes.
- `BuildContentTests` shows how to read `GET /api/v1/build/content` with the
  `X-Build-Token` header (`ApiFactory.BuildTokenValue`), and how to publish a page
  with a `case_cards` reference (`SaveWithSectionAsync`, 330-370).
- No test anywhere feeds API output to the website's checks. The website's tests
  use the committed snapshot (`website/fixtures/snapshot/content.json`).
- CI job `api` (`.github/workflows/ci.yml:41-128`) has .NET and SQL Server, and no
  Node step. Job `website` (130-183) has Node and `npm ci`, and no API.

**What runs in this container.**

- .NET SDK from `dn.sh`. Release build of `api/tests/DigitalHub.Api.Tests` at
  `77296ba`: `13 Warning(s)`, `0 Error(s)`. `bin/` and `obj/` are ignored; the tree
  stayed clean.
- No SQL Server. The full suite pointed at an unreachable server
  (`127.0.0.1,4299`, `ApiFactory` rewrites the catalog to `DigitalHubContent_Test`):
  ```
  Failed!  - Failed:   321, Passed:   173, Skipped:     0, Total:   494
  ```
  The 173 passing names are saved in
  `/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm02/base-passed.txt`.
  They include `RedirectPathRuleTests.The_api_rule_is_the_website_builds_rule`, so a
  DB-free fact runs in a class that has the `ApiFactory` fixture.
- Node 22.23.4. `website/node_modules` is not installed in this worktree. I did
  not install it (architect rule). The website's own suite was NOT RUN here.

## 3. Design

### 3.1 Redirects: one address rule, used by every check

Add to `RedirectPaths.cs`, beside the character rule it already shares with the
build:

- `Key(string path)`: the address the website build gives a redirect. It is the
  same expression as `web-config.ts:148`: trailing slashes removed, and `"/"` if
  nothing is left.
- `Spellings(string path)`: the stored values that have the same address: `[key]`
  for `"/"`, else `[key, key + "/"]`. Two values are enough because `//` is
  refused (2.2).

The stored value does not change. A redirect saved as `/x/` stays `/x/`, as typed.
Every comparison changes:

- `CreateRedirectAsync`:
  - self-redirect: `Key(from) == Key(to)` gives `redirect_loop`, "A redirect
    cannot point at itself."
  - duplicate: `Spellings(from).Contains(r.FromPath)` gives `409 redirect_exists`.
    This translates to SQL `IN`.
- `OccupiesLivePathAsync`: compares each `PublicPath` with `Key(fromPath)`.
  `PublicPath` never ends in `/` except `"/"` (`ContentPaths.cs`).
- `ResolveDestinationAsync`:
  - `visited` holds keys.
  - Each lookup is `Spellings(current).Contains(r.FromPath)`.
  - A loop is `Key(current) == Key(from)`.
  - Chains collapse through a slash too: with `/p → /q` stored, `/c → /p/` is
    stored as `/c → /q`.
- `CheckRedirectAsync` (import):
  - the same three changes;
  - plus "another redirect starts at the same address": a row with a different
    `Id` whose `FromPath` is in `Spellings(from)`.
  - The import writes the rows before it checks them (`ContentBundle.cs:217-232`),
    so this sees the whole bundle.
- `ContentStore.CheckAsync` line 741: `Spellings(path).Contains(r.FromPath)`.
  This keeps design 4.4 ("never equal to the source of an active redirect") true
  for `/s/` too.
- `ContentStore.RetargetAsync`: only the comparisons on `FromPath`:
  - the query's `FromPath == oldPath` becomes `Spellings(oldPath).Contains(FromPath)`;
  - the loop filter's `FromPath != oldPath` becomes a key comparison;
  - `own` becomes `Key(FromPath) == oldPath`;
  - the self-check `FromPath == ToPath` becomes a key comparison.
  This change writes redirects. Without it, a rename can create a second row with
  the same address, and the build fails (test R6). Its `ToPath` comparisons are
  target integrity (ADM-07 part 3) and stay as they are.

Titles, codes and statuses of the refusals do not change. Only the cases that
reach them change.

### 3.2 Formats: the website's pattern, asserted at publish and import

- **New `api/src/DigitalHub.Api/Content/SchemaFormats.cs`.**
  - `WebsiteUuidSource`: the exact JavaScript source from `validate.ts:71`, for the
    drift test.
  - The .NET `Regex`: `\A[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\z`,
    `CultureInvariant`. It uses explicit ranges, not `IgnoreCase`, and `\z`, not `$` (2.3).
  - `EvaluationOptions Asserting()`: `OutputFormat.List`, `RequireFormatValidation = true`,
    and its own `FormatRegistry` with `new RegexFormat("uuid", regex)`. The global
    `FormatRegistry` is not touched.
  - `EvaluationOptions Annotating()`: today's options, unchanged.
- **`SectionSchemaSet` and `CollectionSchemaSet`.** Each holds both option sets.
  - `Validate(type, json)` uses `Asserting()`. The name every existing caller uses
    becomes the strict check, so a new caller fails closed (P-5).
  - A new `ValidateDraft(type, json)` uses `Annotating()`. That is today's
    behaviour, for saves.
- **`ContentStore.CheckAsync`** gets `bool publishing`.
  - `true` from `PublishAsync` (line 311) and from `CheckDocumentAsync` (680, the
    import: it writes published rows straight to the tables).
  - `false` from save (596, 634), restore (450) and unpublish (367).
  - With `publishing`, it calls `Validate`; otherwise `ValidateDraft`.
- **Messages.** The refusal is the library's text with the instance location, for
  example `sections[0]: /items/0/reference/id format: Value is not a match for the
  format 'uuid'.` That is the same form as every other schema error today.
  Readable messages are ADM-09 and ADM-20.

**Why publish and not save:**

- The build reads only published content (`BuildContentTests.Drafts_are_never_included`).
  So checking at publish and import is enough to keep API-accepted content
  buildable.
- The Studio sends `id: ""` and `mediaId: ""` in normal use (2.3). There is no
  Clear for either (ADM-09). If save refused them, a person who changed a
  reference's type by mistake could not save any of their work on the item until
  they picked something. That is ADM-09's defect, made worse.
- At publish the refusal is a publish finding, which the Studio already lists, and
  the work is saved.
- "Save is not publish" (settled design). A draft can hold an unfinished value. A
  published item cannot hold one that breaks the build.

### 3.3 The test that feeds API-accepted content to the website's checks

- **New `website/src/content/check-content.ts`** exports
  `checkContent(content: BuildContent): string[]`:
  - It runs `validateContent(content)` (the prepare step's check).
  - Then it runs `renderWebConfig(content.redirects ?? [], { tagManager: tagManagerId(content.settings) !== null })`
    (the web.config step's check, as `scripts/write-web-config.ts` calls it).
  - A `WebConfigError` becomes one more problem line. Any other error is rethrown.
  - No new rule. These are the two checks a real build runs on content, called as
    the build calls them.
- **New `website/scripts/check-content.ts`**: reads a `BuildContent` JSON file named
  on the command line. If there are problems, it prints them one per line and
  exits 1. Otherwise it prints `The content passed the website's checks.` and
  exits 0. **`website/package.json`** gets `"check:content": "tsx scripts/check-content.ts"`.
  ADM-01a and the exit-gate check can use it too (section 9, O-ADM02-2).
- **New API test `ApiAcceptedContentTests`** (5.1, W1). It tries the ADM-02 cases
  through the API, then reads `GET /api/v1/build/content` as a build does.
  - It keeps only this run's content: items whose slug starts with the run's
    marker, and redirects whose from path contains it.
  - It recomputes `counts`, and sets `errorPages` to `{ "404": null, "500": null }`.
  - Everything else is kept as returned.
  - It writes that to a temporary file and runs
    `node website/node_modules/tsx/dist/cli.mjs website/scripts/check-content.ts <file>`
    (the `tsx` bin in `package-lock.json`: `"tsx": "dist/cli.mjs"`), with `website/`
    as the working directory.
  - It asserts that no problem line contains the marker.
  - Why scoped: `DigitalHubContent_Test` is shared by the whole suite, and other
    tests' rows (some inserted straight into the database, 2.4) are not this
    test's subject. `renderWebConfig` stops at the first bad redirect, so
    unrelated redirects would hide this test's own.
  - Unrelated problem lines are printed in the test output, not asserted.
- **Canary W2:** the same runner, given a hand-made bad file, must exit 1 with both
  expected messages. This proves the harness can fail (P-6). It needs no database.
- **If `website/node_modules` is missing, W1 and W2 fail** with "Run npm ci in
  website/ first." They never skip (P-5, P-6).
- **CI:** job `api` gets two steps before "Integration tests (Release)":
  - `actions/setup-node@v4` with `node-version: ${{ env.NODE_VERSION }}`,
    `cache: npm`, `cache-dependency-path: website/package-lock.json`, written as
    job `website` writes it;
  - `npm ci` with `working-directory: website`.

### 3.4 Why ADM-07's parts 1 and 2 are here, and part 3 is not

- **Parts 1 and 2 are the same comparison as ADM-02 part 1**, in the same four
  functions (`OccupiesLivePathAsync`, `CreateRedirectAsync`,
  `ResolveDestinationAsync`, `CheckRedirectAsync`). The audit says so: "Same root
  cause as ADM-02. Fix it with path normalisation".
  - Splitting them would put two pull requests on the same lines one after the
    other.
  - It would leave `RedirectPaths.Key` used by some checks and not others, which
    is exactly the defect.
  - They add four tests (R2, R3, R4, R5) and no new code beyond 3.1.
- **Part 3 is a new feature, not a normalisation.** "A target that does not exist
  ... a target check that warns in the Studio and reports in the build" needs:
  - a rule for what a target is (a page path, a legacy `.html` path such as
    `RedirectPathRuleTests`' `/about-us.html`, a folder);
  - a warning channel on `POST /api/v1/redirects`;
  - a change to `studio/src/pages/RedirectsPage.tsx`;
  - a build-side report in `website/`;
  - the `ToPath` comparisons in `ContentStore.DeleteAsync` and `RetargetAsync`
    (2.2);
  - Phase C 10.7 ("Every redirect in the table resolves to a page returning 200").
  That is a second module (Studio and website), it needs design choices of its
  own, and ADM-02 should ship this week. It goes to the ADM-07 change, next in
  the batch order.
- **ADM-07 is a Major, so its end-to-end test** ("The end-to-end suite gets a test
  for each Major") lands with the change that closes it. That test covers all
  three parts: two that pass from this change, and the target check.

### 3.5 Hand-over to ADM-01a

"Report a failed build in the Studio" is ADM-01a ("record build runs, each with its
content cutoff and result"). This change gives ADM-01a two things:

- Fewer failures to report.
- `npm run check:content`, which prints the same problem lines a failing build
  prints (`ContentCheckError`, `WebConfigError`).

ADM-01a decides how a run's result and these lines reach the Studio. Nothing here
touches the Studio.

### 3.6 Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Store the canonical form: strip the trailing slash on save | It changes what staff typed, and toPath `/x/` would silently become `/x`. It needs a data migration of existing rows, and that migration collides on the unique index when a pair already exists. Comparing by key fixes every check with no schema or data change |
| Add a database check constraint that refuses a trailing slash | Schema migration, same collision, and it would refuse rows the build accepts |
| Switch on `RequireFormatValidation` with the library's own `uuid` | Its `uuid` accepts `" 0123…"` (2.3); the website refuses it. The rule must be the website's pattern |
| Register the format in the global `FormatRegistry.Global` | Process-wide side effect on every other schema evaluation in the process and in tests; per-options registry does the same job (2.3 probe) |
| Assert formats at save as well | Turns two normal Studio flows into blocked saves with no Clear (3.2), worsening ADM-09 |
| Check ids with `Guid.TryParse` in `PublishChecks` | Not the website's rule: `TryParse` accepts the 32-digit, brace and parenthesis forms the website refuses (2.3) |
| A committed fixture of "API output" fed to the website's tests | It would be API output from the day it was generated, not from this build of the API: it cannot catch the next drift |
| Website job runs the check against an `api` job artifact (`needs: api`) | Serialises the two longest CI jobs. Installing the website's packages in the `api` job costs one cached `npm ci` |
| Fix ADM-07 part 3 here | Section 3.4 |

## 4. Scope

### Files to create

| File | What |
| --- | --- |
| `api/src/DigitalHub.Api/Content/SchemaFormats.cs` | The website's `uuid` pattern (source text and .NET `Regex`), and the `Asserting()` and `Annotating()` option factories (3.2) |
| `website/src/content/check-content.ts` | `checkContent(content)`: `validateContent` plus `renderWebConfig`, as the build calls them (3.3) |
| `website/scripts/check-content.ts` | CLI around `checkContent`: problems on stdout, exit 1; or the pass line, exit 0 |
| `website/test/check-content.test.ts` | C1 to C3 (5.1) |
| `api/tests/DigitalHub.Api.Tests/RedirectAddressTests.cs` | R1 to R7 (database) |
| `api/tests/DigitalHub.Api.Tests/RedirectAddressRuleTests.cs` | K1 (DB-free, the address-key drift guard) |
| `api/tests/DigitalHub.Api.Tests/SchemaFormatTests.cs` | F1 (DB-free) and F2 to F5 (database) |
| `api/tests/DigitalHub.Api.Tests/ApiAcceptedContentTests.cs` | W1 (database) and W2 (DB-free canary) |

### Files to change

| File | What changes |
| --- | --- |
| `api/src/DigitalHub.Api/Content/RedirectPaths.cs` | Add `Key` and `Spellings`; extend the summary to say the key is `web-config.ts`'s |
| `api/src/DigitalHub.Api/Content/AdminStore.cs` | `CreateRedirectAsync` (137, 140), `OccupiesLivePathAsync`, `ResolveDestinationAsync`, `CheckRedirectAsync` (plus its duplicate-address check) use the key (3.1). Nothing else in the file |
| `api/src/DigitalHub.Api/Content/ContentStore.cs` | `CheckAsync` gains `publishing` and calls `Validate` or `ValidateDraft`; the slug-is-a-redirect-source check (741) uses `Spellings`; `PublishAsync` and `CheckDocumentAsync` pass `publishing: true`; `RetargetAsync`'s `FromPath` comparisons use the key (3.1, 3.2) |
| `api/src/DigitalHub.Api/Content/SectionSchemaSet.cs` | Two option sets; `Validate` asserts formats; new `ValidateDraft` does not |
| `api/src/DigitalHub.Api/Content/CollectionSchemaSet.cs` | Same as `SectionSchemaSet` |
| `website/package.json` | `"check:content"` script. No dependency change; the lockfile is not touched (B-7) |
| `.github/workflows/ci.yml` | Job `api`: `actions/setup-node@v4` and `npm ci` in `website/`, before "Integration tests (Release)" (3.3). Nothing else |

### Out of scope (left alone on purpose)

- **ADM-07 part 3, to the ADM-07 change:**
  - the target check;
  - its Studio warning (`RedirectsPage.tsx`);
  - its build report;
  - the `ToPath` comparisons in `ContentStore.DeleteAsync` (250) and `RetargetAsync`;
  - ADM-07's end-to-end test.
- **ADM-02 part 4, to ADM-01a:** reporting a failed build in the Studio (3.5).
- **Readable schema and redirect messages:** ADM-09, ADM-14 and ADM-20. The Studio
  shows `problem.title` for a refused redirect behind the open modal
  (`RedirectsPage.tsx:76-80`); ADM-14 owns that.
- **Clear controls for references and images:** ADM-09.
- **Error-page saves** (`AdminStore.UpdateErrorPageAsync`, 549-598): ADM-05. They
  hold rich text only, which has no `format` field.
- **Rich-text `relatedItems`** inside a blog body: references in a JSON string,
  which the website's schema check does not see and which do not stop a build.
  Not an ADM-02 case.
- **Case of letters in redirect paths:** the database is already stricter than
  the build (2.2).
- **`ReferenceConverter.cs` (`--convert-references`)** is not changed. It calls
  `SectionSchemaSet.Validate` over stored sections, which now also reports
  `format` failures. That is the right answer for a stored-content check, and
  that tool writes, so it is not the detection tool for O-ADM02-2.
- **`ContentBundle.cs`** is not changed. It already calls `CheckRedirectAsync` and
  `CheckDocumentAsync`, which change underneath it.
- **Every Studio file.** In particular `studio/src/content/RichTextEditor.tsx` and
  its tests, which belong to ADM-03 (#52).
- **No migration** (section 7).

## 5. Test plan

### 5.1 Failing tests, written first

Each name below is the test method; the marker in each test is
`"adm02-" + Guid.NewGuid().ToString("N")[..8]`. Database tests are
`[Collection("SqlServer")]` with `IClassFixture<ApiFactory>`, log in as the admin
(`AuthSession.LoginAsync`), and delete what they create in a `finally` block
(redirects through `DELETE /api/v1/redirects/{id}`; items unpublished, then deleted,
as `AdminApiTests` does). Rows inserted straight into the database are removed the
same way `ContentPublishTests` removes them.

**`RedirectAddressTests.cs` (database).**

| # | Test | Asserts | Red at base (from 2.2) | Green |
| --- | --- | --- | --- | --- |
| R1 | `A_trailing_slash_does_not_make_a_second_redirect` [Theory: (`/m`, `/m/`), (`/m/`, `/m`)] | First POST 201; second POST `409`, code `redirect_exists`; `GET /api/v1/redirects?search=<m>` total 1 | Second POST 201, total 2 | As asserted |
| R2 | `A_redirect_to_its_own_address_is_refused_with_or_without_a_slash` [Theory: (`/m-a`, `/m-a/`), (`/m-a/`, `/m-a`)] | `400 redirect_loop` | 201 | As asserted |
| R3 | `Loops_and_chains_are_seen_through_a_trailing_slash` | With `/m-p → /m-q`: `/m-q/ → /m-p/` is `400 redirect_loop`; `/m-c → /m-p/` is 201 with `toPath` `/m-q` | 201; then `toPath` `/m-p/` | As asserted |
| R4 | `A_redirect_cannot_take_over_a_live_address_with_a_trailing_slash` [Theory: `pages` `/<slug>/`, `case-studies` `/cases/<slug>/`, `blog-posts` `/blogs/<slug>/`] | Publish the item (as `BuildContentTests.DescribeAsync` and `ContentPublishTests` do), then POST that path with a slash: `400 redirect_live_path` | 201 (the audit's `/blogs/<live-slug>/`) | As asserted |
| R5 | `Publishing_is_refused_where_a_redirect_with_a_slash_starts` | Draft page `<m>`; POST `/<m>/ → /m-elsewhere` is 201 (not live yet); publish the page: `400 publish_blocked`, body contains "source of a redirect" | Publish 200: the redirect now takes over the page | As asserted |
| R6 | `A_rename_reuses_the_redirect_that_starts_at_the_old_address_with_a_slash` | Publish page `<m>`; insert via `ContentDbContext` a legacy row `/<m>/ → /m-x` (as `ContentPublishTests` inserts rows); rename to `<m>-new` and publish; exactly one row has key `/<m>`, and its `ToPath` is `/<m>-new` | Two rows, `/<m>/` and `/<m>`: the build fails "Two redirects start at /<m>/." | As asserted |
| R7 | `The_import_check_refuses_a_shared_address_and_a_self_redirect` | Insert `/m-i` and `/m-i/`, and `/m-j → /m-j/`, via `ContentDbContext`; `AdminStore.CheckRedirectAsync(db, row)` returns a `fromPath` error for `/m-i/` and a `toPath` error for `/m-j → /m-j/` | No errors | As asserted |

**`RedirectAddressRuleTests.cs` (DB-free, no fixture).**

| # | Test | Asserts |
| --- | --- | --- |
| K1 | `The_api_address_is_the_website_builds_address` | `web-config.ts` still contains `row.fromPath.replace(/\/+$/, "") \|\| "/"` in `redirectRules` and `fromPath.slice(1).replace(/\/+$/, "")` in `matchPattern` (found as `RedirectPathRuleTests.WebConfigSource` finds the file); `RedirectPaths.Key` gives `/`→`/`, `/x`→`/x`, `/x/`→`/x`, `/a/b/`→`/a/b`; `Spellings` gives `["/"]` and `["/x", "/x/"]` |

K1 names `RedirectPaths.Key`, which does not exist at the base, so it cannot be in
the red commit without breaking the build of the test project. It is a drift
guard, not the regression test, and it lands with the fix (5.2). The regression
tests are R1 to R7.

**`SchemaFormatTests.cs`.**

| # | Test | Asserts | Red at base | Green |
| --- | --- | --- | --- | --- |
| F1 | `The_api_checks_uuid_as_the_website_build_does` (DB-free; reads files, constructs `new SectionSchemaSet()`) | (a) `validate.ts` has exactly one `addFormat`, and it is `ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);`. (b) The set of `"format"` values in `packages/sections/*.json` and `packages/collections/*.json` is `{ "uuid" }`. (c) For each case, `Validate("case_cards", <reference id = case>)` has errors exactly when the website refuses it. Cases and website verdicts (from 2.3, Node): lower-case valid ✓, upper-case valid ✓, `not-a-uuid` ✗, `""` ✗, 32-digit ✗, braces ✗, leading space ✗, trailing `\n` ✗, full-width digit ✗ | Fails at (c): `not-a-uuid` gives no error (2.3 probe) | Passes |
| F2 | `Publishing_refuses_an_id_the_website_would_refuse` [Theory: `case_cards` `items[0].reference.id` = `not-a-uuid`, `""`, the 32-digit form of a published case study's id; `case_cards` `items[0].image.mediaId` = `not-a-uuid` (with `alt`); `related_items` `items[0].id` = `not-a-uuid`] | Save is 200; publish is `400 publish_blocked`, body contains `format 'uuid'` | Publish 200 | As asserted |
| F3 | `A_draft_with_an_unchosen_reference_still_saves` | Save with `reference: { type: "service", id: "" }` is 200 (3.2) | Passes (guard) | Passes |
| F4 | `An_upper_case_uuid_reference_publishes` | Reference to a published case study, id in upper case: publish 200 | Passes (guard against over-strictness) | Passes |
| F5 | `The_import_check_refuses_an_id_the_website_would_refuse` | `ContentStore.CheckDocumentAsync` (resolved from a scope) on a page document whose `case_cards` reference id is `not-a-uuid` returns a `sections[0]` error with `format 'uuid'` | No error | As asserted |

**`ApiAcceptedContentTests.cs`.**

| # | Test | Asserts | Red at base | Green |
| --- | --- | --- | --- | --- |
| W1 | `Content_the_api_accepted_passes_the_website_checks` (database, Node) | Through the API, and without asserting the API's answers: create `/m-x` and `/m-x/`; publish page `<m>-bad` with a `case_cards` reference id `not-a-uuid`; publish page `<m>-good` with a reference to a published case study `<m>-target`. Then build the scoped file (3.3) and run the website's check. No problem line contains the marker; exit code 0 if no line at all | Exit 1. Lines: `Two redirects start at /m-x/.` and `pages/<m>-bad: section 1 (case_cards) does not match sections/case_cards.json: /items/0/reference/id must match format "uuid"` | Exit 0 for the marker's content: the API refused both (409, 400) |
| W2 | `The_website_check_fails_on_a_bad_file` (DB-free, Node) | The runner on a hand-made file (the committed snapshot's `content.json`, plus redirects `/x` and `/x/`, plus one page whose `case_cards` reference id is `not-a-uuid`) exits 1 with both messages | Passes (canary) | Passes |

**`website/test/check-content.test.ts` (vitest).**

| # | Test | Asserts |
| --- | --- | --- |
| C1 | `passes the committed snapshot` | `checkContent(snapshot)` is `[]` |
| C2 | `refuses two redirects that differ by a trailing slash` | Contains `Two redirects start at /x/.` |
| C3 | `refuses a section reference id that is not a uuid` | Contains a line with `must match format "uuid"` |

At commit 1, C1 to C3 and W2 pass: they test the website's existing checks and
the new harness, not the defect. That they pass is what makes W1's red mean
"the API accepted it", not "the harness is broken".

### 5.2 Commit order (B-6, P-4)

1. `ADM-02: Test that API-accepted content passes the website's checks`
   - All test files except `RedirectAddressRuleTests.cs`.
   - The harness: `website/src/content/check-content.ts`,
     `website/scripts/check-content.ts`, the `package.json` script, and the
     `ci.yml` steps.
   - No change under `api/src/`. The harness adds no product behaviour. It runs
     the website's own checks, so it belongs with the tests that use it.
2. `ADM-02: Compare redirect addresses as the website build does`
   - `RedirectPaths.cs`, `AdminStore.cs`, the redirect parts of `ContentStore.cs`,
     and `RedirectAddressRuleTests.cs` (K1).
   - Makes R1 to R7 green.
3. `ADM-02: Assert the website's uuid format at publish and import`
   - `SchemaFormats.cs`, `SectionSchemaSet.cs`, `CollectionSchemaSet.cs`, and the
     `publishing` part of `ContentStore.cs`.
   - Makes F1, F2, F5 and W1 green.

Commits 2 and 3 can be reverted separately.

### 5.3 Local evidence, in this container

Set up:

```bash
. /tmp/claude-0/-home-user-DH-WEBSITE/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/dn.sh
cd /home/user/dh-change-adm02/api
export CS="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True"
```

Port 4299 has no listener and `ApiFactory` rewrites the catalog to
`DigitalHubContent_Test`. No database is touched. Use a fresh `HOME` per run.
The developer runs `npm ci` in `website/` from the unchanged lockfile, for W2
and C1 to C3.

**After commit 1 (red):**

```bash
dotnet build DigitalHub.slnx -c Release
HOME=<fresh> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build \
  --filter "FullyQualifiedName~DigitalHub.Api.Tests.SchemaFormatTests.The_api_checks_uuid_as_the_website_build_does|FullyQualifiedName~DigitalHub.Api.Tests.ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file"
cd ../website && npx vitest run test/check-content.test.ts && npm run typecheck
```

- Expected: F1 fails at its case table, quoted as run (`not-a-uuid` gets no API
  error). W2 passes. C1 to C3 pass. Typecheck passes.
- R1 to R7, F2 to F5 and W1 need SQL Server. Locally they fail on the connection,
  which is not the red. They are NOT RUN here; CI job `api` covers them (5.4).

**After commits 2 and 3 (green):**

- The same commands, plus K1. Expected: F1, K1, W2 and C1 to C3 pass.
- Full API suite without a database:
  `HOME=<fresh> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --logger "trx;LogFileName=<scratch>/adm02-after.trx"`.
  - Extract the passed names and diff them against
    `/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm02/base-passed.txt`
    (173 names at `77296ba`).
  - Expected: all 173 still pass, plus F1, K1 and W2. Any name that passed and
    now fails is a regression to report before anything else.
- `dotnet build DigitalHub.slnx -c Release`: 0 errors, no more than the 13
  warnings of 2.4.
- `cd website && npm run typecheck && npx vitest run`: all pass.

### 5.4 CI evidence on the pull request

- **Red, job `api`, at commit 1.** This waits on O-ADM02-1. Expected failing tests,
  and nothing else:
  - R1 (2 cases), R2 (2), R3, R4 (3), R5, R6, R7;
  - F1, F2 (5 cases), F5;
  - W1.
  F3, F4 and W2 pass. Quote each failure's assertion. W1's output must show the
  two lines in 5.1.
- **Green, every job of `ci.yml` on the final head:**
  - `api`: all tests pass. Quote the count from the TRX: the base's total plus the
    new ones.
  - `website`, `studio` (unit and end-to-end), `section-compare`,
    `website-browser`.
  - `workflow-lint.yml` (actionlint) on the changed `ci.yml`.
  - `security.yml`.
- **Watch** the `studio` end-to-end job: test 10.21 (`studio.spec.ts:163`) picks a
  reference and saves. Save is unchanged, so it must stay green.

### 5.5 Track checklist (G3), from `docs/changes/README.md`

| Item | How it is met |
| --- | --- |
| The finding, its evidence and its fix come from the audit | Section 1 quotes ADM-02 and ADM-07. 2.2 and 2.3 reproduce what can run here. The fix is the audit's: "Normalise paths in every redirect check", "Enforce the same formats in the API", "Add a test that feeds API-accepted content to the website's checks" |
| The regression test is committed and shown failing before the fix | Commit 1 comes before commits 2 and 3. F1 is red locally. R1 to R7, F2, F5 and W1 are red in CI only if O-ADM02-1 is "Yes". If it is "No", this row is not met, and the delivery is BLOCKED ON OWNER until the owner accepts NOT RUN red in words (a D-NNN entry). No role may waive it (P-7) |
| The end-to-end suite gets a test for each Major | ADM-02 is a Blocker. ADM-07 (Major) is only partly closed here. Its end-to-end test lands with the ADM-07 change, which closes it (3.4) |
| A Minor that is not fixed becomes a D-NNN entry | Not a Minor |
| G3-1 exit gate: "each blocker reproduced before its fix and passing after it" | Reproduced: 2.2 (website side), 2.3 (both sides), CI red (5.4). Passing: 5.3 and 5.4 |
| G3-1 exit gate: "A clean website build from `DigitalHubContent_Studio` with no patched content" | Not met by this change alone. It needs O-ADM02-2 (existing rows) and ADM-05 (error pages, `prepare.ts:44-47`) |

## 6. Security impact

- **Routes and policies:** none changed. `POST /api/v1/redirects` and the
  content save and publish routes keep their policies.
- **Input validation:** stronger (A-5).
  - Redirects that would loop, take over a live page, or share an address are
    refused, so they can no longer reach `web.config`.
  - Published content must match the website's `uuid` format.
  - Nothing that is refused today becomes accepted. Comparing by key only adds
    matches.
  - The new regular expression is anchored and linear, and runs only on values the
    schema has already typed as strings: no backtracking risk.
- **Data:** no schema or data change. No row is rewritten.
- **Logins and secrets:**
  - W1 uses the test build token `ApiFactory.BuildTokenValue`, which is already in
    the test project.
  - The temporary file holds only test content, is written under the test's temp
    directory, and is deleted in `finally`.
- **Dependencies and supply chain:**
  - No new package.
  - Job `api` now runs `npm ci` from `website/package-lock.json`, which job
    `website` already runs, so the same packages and install scripts run in one
    more job. That job has the SQL Server service and its workflow-only passwords
    in its environment. Those are CI-only values already in `ci.yml`, not
    secrets.
  - Actions stay `@v4`, as the rest of `ci.yml` (SHA pinning is G1 Wave work, not
    this change).
- **Child process:** W1 and W2 start `node` with fixed arguments and a file path
  the test generated. No input from outside the test reaches the command line.

## 7. Migrations

None. No entity, column, index or constraint changes, and no data is rewritten
(3.6 says why storage is not canonicalised).

**Existing rows that become invalid:**

- **Redirect pairs that share an address.** They are still in the table. The
  build already fails on them today. After this change the API refuses new ones,
  but the existing rows must be removed.
- **Self-redirects** (`/a → /a/`) and **redirects that start at a live page with a
  slash.** They still build, and still loop or take over the page.
- **Published items holding a non-`uuid` id.** They still stop the build. Their
  next publish is refused until the id is fixed. Their next save is not refused
  (3.2).

These were produced by the audit run in `DigitalHubContent_Studio`, so they are
probably there. That is not verified: there is no SQL Server here. The handling
is in section 9, O-ADM02-2. None of it is a migration.

## 8. Rollback

- Revert the pull request. Nothing is stored differently, so nothing needs
  cleaning up.
- Commits 2 (redirects) and 3 (formats) can be reverted separately.
- After a revert, content saved under the new rules is still valid under the old
  ones, because the new rules only refuse more.
- If the `ci.yml` step alone causes trouble, reverting the whole pull request is
  the rollback. W1 cannot pass without it (P-6).

## 9. Owner decisions needed

- **O-ADM02-1. Status: PENDING.**
  - **Question:** "May the developer push ADM-02's first commit (tests and the
    website check harness only) to `change/ADM-02` and open the pull request before
    the fix commits are pushed, so that CI's `api` job shows the redirect, format
    and API-to-website tests failing first? CI would be red on that pull request
    until the rest is pushed."
  - **Answers to offer:** "Yes, push the red tests first" (recommended), or "No,
    push only when finished".
  - **Not assumed from earlier changes.** The owner answered the same question for
    ADM-06b ("Yes, red test first like #49", Mohamed Elbadry, 11 November 2026, as
    quoted in the ADM-03 plan). Those words cover ADM-06b. This plan does not take
    them as an answer for ADM-02.
  - **Why it is asked:** the G3 rule requires the regression test "shown failing
    before the fix". 18 of the 19 red cases in 5.4 need SQL Server (all but
    F1), which this container lacks, and CI runs only on a pull request.
  - **What does not wait:** development, the commits in order, the local evidence
    (5.3), the review, testing and both gates.
  - **If "No":** the red for R1 to R7, F2, F5 and W1 is NOT RUN, and the delivery is
    BLOCKED ON OWNER until the owner accepts that in words (a D-NNN entry in
    `docs/deferred-items.md` with the rule waived, the reason, the owner's words
    and date, the follow-up owner and an expiry), or changes the answer.

- **O-ADM02-2. Status: PENDING.** What happens to the rows in
  `DigitalHubContent_Studio` that the new rules would refuse (section 7).
  - **Question:** "After ADM-02 merges, may an agent you name list, read-only, the
    redirects and published items in `DigitalHubContent_Studio` that the new rules
    refuse, and show you the list? Then, for each one, you (or an agent you name)
    fix it through the Studio: delete the redirect, or pick the item again and
    publish. Do Studio fixes like these count as 'no patched content' for the G3-1
    exit gate?"
  - **Answers to offer:**
    - "Yes, list them; I choose the fixes; fixes through the Studio count"
      (recommended);
    - "Yes, list them, and delete the audit's test redirects without asking";
    - "No, leave the database as it is".
  - **Why recommended:**
    - The fixes go through the product, so each one is audited and none is a hand
      edit.
    - No migration has to guess which of two redirects to keep.
    - Since the build has failed on any such pair, nothing live depends on either
      row.
  - **The read-only list** (no writes, one agent at a time):
    - (a) This query on `DigitalHubContent_Studio`. It is a `SELECT` only:
      ```sql
      WITH keyed AS (
        SELECT id, from_path, to_path, source, created_at,
               CASE WHEN from_path <> '/' AND RIGHT(from_path, 1) = '/' THEN LEFT(from_path, LEN(from_path) - 1) ELSE from_path END AS from_key,
               CASE WHEN to_path   <> '/' AND RIGHT(to_path, 1)   = '/' THEN LEFT(to_path,   LEN(to_path)   - 1) ELSE to_path   END AS to_key
        FROM dbo.redirects)
      SELECT 'shares an address' AS problem, k.id, k.from_path, k.to_path, k.source, k.created_at
      FROM keyed k
      WHERE k.from_key IN (SELECT from_key FROM keyed GROUP BY from_key HAVING COUNT(*) > 1)
      UNION ALL
      SELECT 'points at itself', k.id, k.from_path, k.to_path, k.source, k.created_at
      FROM keyed k
      WHERE k.from_key = k.to_key
      ORDER BY from_path;
      ```
    - (b) `npm run check:content -- <file>` on the response of
      `GET /api/v1/build/content` from an API running against
      `DigitalHubContent_Studio` (a read). It lists every problem a build would stop
      on: shared addresses and non-`uuid` ids.
    - (c) For redirects that take over a live page with a slash: export a bundle
      with `DigitalHub.ContentImport export --database DigitalHubContent_Studio`
      (a read), then run `import --dry-run` on it into a freshly reset
      `DigitalHubContent_Test`. The dry run uses the fixed `CheckRedirectAsync` and
      `CheckDocumentAsync`, and changes nothing. That writes only to
      `DigitalHubContent_Test` (reset first, one agent at a time). It needs the
      owner's go-ahead because it resets a shared test catalog.
  - **What does not wait:** this change's development, review, tests and merge.
    Only the G3-1 exit-gate build waits on it (and on ADM-05).

- **Behaviour changes, for the owner to see.** They go in the pull request body
  too. They are the fix itself, so they are not asked as separate decisions. Say
  so before gate 1 if any is not wanted.
  - B1: A redirect whose from path differs from an existing one only by a trailing
    slash is refused, `409 redirect_exists`. Today: 201, and the build stops.
  - B2: A redirect from `/a` to `/a/` (or the reverse) is refused,
    `400 redirect_loop`. Today: 201, and the site loops.
  - B3: A redirect from a live page's address with a trailing slash is refused,
    `400 redirect_live_path`. Today: 201, and the page answers 301.
  - B4: Publishing an item whose address is where a redirect with a trailing slash
    starts is refused, `400 publish_blocked`. Today: it publishes, and the
    redirect takes the page over.
  - B5: A redirect to `/p/`, when `/p` already redirects to `/q`, is stored as
    `/q` (chains collapse, design 4.5). Today it is stored as `/p/`.
  - B6: Publishing (and the content-bundle import) refuses an id or media id that
    is not a UUID in the website's form, with the schema's message. This includes
    an empty id left by changing a reference's type, and an empty media id left by
    typing alt text before choosing an image. Today: it publishes, and the build
    stops. Saving such a draft is still allowed.

- **Noted, not a decision.** ADM-07 is split: parts 1 and 2 here, part 3 and its
  end-to-end test in the ADM-07 change (3.4). If the owner wants all of ADM-07 in
  one pull request, say so before gate 1.

## 10. Risks

| Risk | Effect | Caught by |
| --- | --- | --- |
| A section of the API and the website disagree on something besides `uuid` | W1 shows a marker problem other than the two planned | W1 prints every problem line. The developer reports it and stops (BACK TO ARCHITECT); scope is not widened silently |
| Another test's rows break the website's check for the shared test database | Problem lines without the marker | Printed, not asserted (3.3). Reported to the coordinator as a finding for its own change |
| `website/node_modules` missing in the `api` job, or `tsx`'s bin path changes | W1 and W2 fail | They fail closed with "Run npm ci in website/ first"; W2 is the canary that the runner can fail and can pass |
| The asserting options miss `$ref`'d definitions (`defs.json`) | Format not checked inside a reference or media | F1 uses `case_cards`, whose reference and image are both `$ref`s into `defs.json`; F2 covers three paths |
| .NET `$` before a newline | A `uuid` with a trailing newline is accepted | `\z` in the pattern; F1's trailing-`\n` case |
| The global format registry changes for other code | Other evaluations change | Per-options registry only (3.2); the 173-name DB-free baseline diff (5.3) |
| An existing test publishes content with a non-UUID id | That test turns red | grep found no such test (only rich-text bodies, which are not schema fields). CI `api` is the check; any such failure is reported, not "fixed" by loosening (P-6) |
| The import of the old site's content carries non-UUID ids | A future import is refused | That is correct: the build would refuse them too. The import's own report names each one |
| SQL `IN` with a two-value list misses a row because of the case-insensitive collation | No: the collation makes more rows match, never fewer | R1 to R7 |
| Studio users hit the new publish refusal with a raw message | Confusion | B6 is shown to the owner. Readable messages are ADM-09 and ADM-20 |
| ADM-07 part 3 waits | Dangling targets can still be built | Listed out of scope with a destination. The ADM-07 change is next in the batch order |
| The exit gate also needs the existing rows fixed and ADM-05 | G3-1 cannot close on ADM-02 alone | O-ADM02-2. Stated in 5.5 |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `/x/` and `/x` are no longer both accepted | Audit ADM-02, bullet 1 | Planned | |
| Redirect paths compared by the build's address key in every redirect check: create (duplicate, self), live-path, loop and chain, import check, slug-is-a-source, rename | Audit ADM-02, Fix 1 | Planned | |
| The API key is locked to `web-config.ts`'s key (drift guard) | Audit ADM-02, bullet 1 (AdminStore vs web-config) | Planned | |
| A non-UUID section reference id is not published | Audit ADM-02, bullet 2 | Planned | |
| The API asserts the formats the build asserts, with the website's `uuid` pattern, at publish and import | Audit ADM-02, Fix 2 | Planned | |
| The API's format rule is locked to `validate.ts` (drift guard) | Audit ADM-02, Fix 2 | Planned | |
| A test feeds API-accepted content to the website's checks | Audit ADM-02, Fix 3 | Planned | |
| Report a failed build in the Studio | Audit ADM-02, Fix 4 | Moved to ADM-01a | |
| `/blogs/<live-slug>/` (trailing slash on a live address) refused | Audit ADM-07, bullet 1 | Planned | |
| `/a → /a/` refused | Audit ADM-07, bullet 2 | Planned | |
| A target that does not exist: Studio warning and build report (Phase C 10.7) | Audit ADM-07, bullet 3 | Moved to ADM-07 | |
| Redirect `ToPath` comparisons on delete and rename | Found here (2.2) | Moved to ADM-07 | |
| End-to-end test for the Major | G3 checklist, ADM-07 | Moved to ADM-07 | |
| Existing rows that the new rules refuse are listed and fixed | Found here (section 7) | Planned (waits on O-ADM02-2) | |
| Regression tests committed and shown failing before the fix | G3 checklist; refinement plan Track G3 | Planned (CI red waits on O-ADM02-1) | |
| No regression in the DB-free baseline (173 names at `77296ba`) | P-8 | Planned | |

## 12. Revision log

- **Round 1 (11 November 2026):** first version.
