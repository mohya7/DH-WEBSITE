# ADM-02: plan

Change id: `ADM-02`. Branch: `change/ADM-02`, worktree `/home/user/dh-change-adm02`,
cut from `origin/rebuild/dotnet-platform` at `77296ba`.
Architect, round 2, 11 November 2026. Round 1 (`84bf73a`) came back CHANGES
NEEDED (`plan-review.md` Round 1 at `7f67959`: two Majors, five Minors). Section 12
answers each one. The main changes:

- Formats are now strict only for **published** rows, in the bundle import too, so
  `ContentBundle.cs` changes.
- The API now refuses upper-case ids at publish, because the website's lookups
  compare exact lower-case strings.

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

Round 2 also read `docs/changes/ADM-02/plan-review.md` (Round 1). There is no
`plan-approval.md` or `implementation.md` yet.

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

**Upper-case ids pass the format and then fail the website's lookups** (added in
round 2, from review finding 2). The website's `uuid` accepts upper case (`/i`).
Its lookups compare exact strings with the API's ids, which are always lower case.
The API serialises a `Guid` in the lower-case `"D"` form, and
`BuildContentStore.cs:112` keys references as `type + ":" + id.ToString("D")`.

- `website/src/content/validate.ts:116-123`: `missingMediaIds` uses `known.has(value)`,
  which is case-sensitive. At `:212-214` a missing id is a build problem. So a
  `mediaId` in upper case stops the build with
  `Media <ID> is used by published content but is not in the media list.`
- `website/src/content/site.ts:48,58,62`: `mediaById.get(id)` and
  `content.references[\`${type}:${id}\`]` are exact. So a reference in upper case
  resolves to `null`, and the link silently disappears.
- The API finds both ids case-insensitively: `Guid.TryParse` in
  `PublishChecks.cs:241`, `MediaUsage.cs:131` and `BuildContentStore.cs:213-222`.
  So it publishes them, and does not list the reference in `unresolvedReferences`.
- Reproduced with `node -e`: the website pattern accepts
  `"01234567-89AB-CDEF-0123-456789ABCDEF"` (`true`).
- The Studio never sends upper case. Picked items and media come from API lists in
  `"D"` form. The old-site importer writes `ToString("D")`
  (`ContentWriter.cs:370,553,1010,1278,1578,1591`; `SectionFields.cs:890,911`).
  So this is reachable through hand-made API calls, and through content imported
  from elsewhere.

**Rich-text bodies carry ids too** (round 2, found while answering finding 2).
`RichText.Validate` accepts any `Guid.TryParse` value: an image's `mediaId` at
`RichText.cs:598`, and `relatedItems[].id` at `:402`. The website's
`missingMediaIds` walks JSON inside strings (`validate.ts:128-134`). So an
upper-case `mediaId` in a rich-text body also stops the build. The paste filter
normalises ids to `"D"` (`RichText.cs:326`), and the Studio inserts library ids, so
neither Studio path produces one. Rich text is a different module from the schema
check. Section 4, "Out of scope", gives its destination.

**The bundle import checks every row, not only published ones** (round 2, from
review finding 1):

- `api/tools/DigitalHub.ContentImport/ContentBundle.cs:377-388`: every row of each
  collection table, whatever its `Status`, goes to `ContentStore.CheckDocumentAsync`.
- `:391-411`: every `working-copies` row (a saved draft of a published item) goes
  there too.
- `ContentStore.cs:679-680`: `CheckDocumentAsync` takes no status.

So the import must know a row's status before choosing the strict check.

**The old-site importer has its own schema check** (round 2, from review finding 3):

- `ContentWriter.cs` writes rows with `Status = ContentStatus.Published`
  (`:225,284,572,626,651`).
- It then runs `ValidateStoredSectionsAsync` (`:86-108`) with
  `SectionSchemas.Load()` (`SectionPreview.cs:256-277`). Those options are
  `OutputFormat.List` only, so format is not asserted.
- It never calls `ContentStore.CheckAsync`.

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

**The slug check runs at save as well as at publish** (round 2, review finding 4).
`CheckAsync` runs on every save (`ContentStore.cs:596`, and `:634` through
`MutateAsync` for section add, update, reorder and visibility). So the slug check
at line 741 refuses saves too, as design line 158 says ("refused on save and on
publish"). Under `Spellings`, a page that is already live and has a legacy `/s/`
redirect cannot be saved until the redirect is deleted. The message is "That
address is the source of a redirect." That is the right outcome: the redirect is
taking over the live page. It is listed as behaviour change B4 and in section 7.

Titles, codes and statuses of the refusals do not change. Only the cases that
reach them change.


### 3.2 Formats: the website's pattern, lower case only, asserted on published rows

**The rule.** A published `format: "uuid"` value must be a UUID in the lower-case
`"D"` form: `\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z`.
That is the website's pattern without the `/i` flag.

**Why lower case only** (round 2, review finding 2, option (a)):

- An upper-case id passes the website's format check. It then fails the website's
  exact-string lookups (2.3): a `mediaId` stops the build, and a reference is
  silently dropped. A rule that only matched the website's format would leave
  ADM-02's own defect in place: content the API accepts that the build stops on or
  drops.
- Being stricter than the website can never break a build. That is the same
  argument as for redirect case in 2.2.
- Nothing the Studio or the old-site importer writes is upper case (2.3), so no
  normal flow is refused.
- There is no strong reason against it:
  - Upper case is valid in RFC 9562 only as input. The API always writes the
    lower-case form.
  - The website's `/i` flag is not a promise that upper case works. Its lookups
    show it does not.
- The library's message for such a value is "Value is not a match for the format
  'uuid'." That is accurate under this rule, and it is only reachable by a
  hand-made id.

**The code:**

- **New `api/src/DigitalHub.Api/Content/SchemaFormats.cs`.**
  - `WebsiteUuidSource`: the exact JavaScript source from `validate.ts:71`, for the
    drift test F1.
  - `Uuid`: the .NET `Regex` above, `CultureInvariant`, with explicit ranges and
    `\z` (2.3).
  - `EvaluationOptions Asserting()`: `OutputFormat.List`, `RequireFormatValidation = true`,
    and its own `FormatRegistry` with `new RegexFormat("uuid", Uuid)`. The global
    registry is not touched. Its documented fallback to the global registry
    matters only for a format other than `uuid`, and F1 (b) fails if one appears.
  - `EvaluationOptions Annotating()`: today's options, unchanged.
- **`SectionSchemaSet` and `CollectionSchemaSet`.** Each holds both option sets.
  - `Validate(type, json)` uses `Asserting()`. The name every existing caller uses
    becomes the strict check, so a new caller fails closed (P-5).
  - A new `ValidateDraft(type, json)` uses `Annotating()`. That is today's behaviour.
- **`ContentStore.CheckAsync`** gets `bool publishing`. With it, it calls
  `Validate`; without it, `ValidateDraft`.
  - `PublishAsync` (line 311) passes `true`.
  - Save (596, 634), restore (450) and unpublish (367) pass `false`.
- **`ContentStore.CheckDocumentAsync`** (680) gets the same `bool publishing`
  argument and passes it through. It no longer decides for the caller.
- **`ContentBundle.CheckAsync`** (`ContentBundle.cs:377-411`) sets it from the row
  (round 2, review finding 1):
  - collection rows: `publishing: record.Status == ContentStatus.Published`.
    `FindRecordAsync` already loads `record`.
  - working copies: `publishing: false`. A working copy is a draft, even of a
    published item.
  - A draft row or a working copy holding `id: ""` therefore imports, as it saved.
  - A published row holding `not-a-uuid` or an upper-case id is refused, with the
    import's usual `"<table> <id>: sections[n]: ..."` line, and the whole import
    rolls back as it does today.
  - `Ended` (a vacancy that has finished) is not `Published`, is not built, and is
    checked as a draft.
- **Messages.** The refusal is the library's text with the instance location, for
  example `sections[0]: /items/0/reference/id format: Value is not a match for the
  format 'uuid'.` That is the same form as every other schema error today.
  Readable messages are ADM-09 and ADM-20.

**Why only at publish, and only on published rows:**

- The build reads only published content (`BuildContentTests.Drafts_are_never_included`).
  So strictness on published rows, in the API and in the import, is enough to keep
  API-accepted content buildable.
- The Studio sends `id: ""` and `mediaId: ""` in normal use (2.3). There is no
  Clear for either (ADM-09). If save refused them, a person who changed a
  reference's type by mistake could not save any of their work on the item. That
  is ADM-09's defect, made worse.
- At publish the refusal is a publish finding, which the Studio already lists, and
  the work stays saved.
- "Save is not publish" (settled design). A draft can hold an unfinished value. A
  published item cannot hold one that breaks the build.

### 3.3 The test that feeds API-accepted content to the website's checks

- **New `website/src/content/check-content.ts`** exports
  `checkContent(content: BuildContent): string[]`:
  - It runs `validateContent(content)`, the prepare step's schema, media and
    inline-text check.
  - Then it runs `renderWebConfig(content.redirects ?? [], { tagManager: tagManagerId(content.settings) !== null })`,
    the web.config step's redirect check, as `scripts/write-web-config.ts` calls it.
  - A `WebConfigError` becomes one more problem line. Any other error is rethrown.
  - No new rule.
  - **What it does not run** (round 2, review finding 6): a real build also stops on
    - `buildRoutes` (`routes.ts:96-101`: a route clash, a reserved first segment,
      no home page);
    - the API-source error-page check (`prepare.ts:43-48`);
    - the output checks after `next build` (`check-output.ts`).
    So `checkContent` runs two of the build's content checks, the two that ADM-02
    is about. It is not a whole build. Leaving the other checks out is deliberate:
    W1's scoped file has no home page and no error pages, and those belong to
    other findings (ADM-05 for error pages). The only check of a whole build is the
    build itself (`CONTENT_SOURCE=api npm run build`), and that is what the G3-1
    exit gate runs.
- **New `website/scripts/check-content.ts`**: reads a `BuildContent` JSON file named
  on the command line. If there are problems, it prints them one per line and exits 1.
  Otherwise it prints
  `The content passed the website's schema, media and redirect checks (not the route or output checks).`
  and exits 0. **`website/package.json`** gets
  `"check:content": "tsx scripts/check-content.ts"`.
- **New API test `ApiAcceptedContentTests`** (5.1, W1). It tries the ADM-02 cases
  through the API, then reads `GET /api/v1/build/content` as a build does.
  - It keeps only this run's content: items whose slug starts with the run's
    marker, and redirects whose from path starts with `/<marker>`.
  - It recomputes `counts`, and sets `errorPages` to `{ "404": null, "500": null }`.
  - Everything else is kept as returned.
  - It writes that to a temporary file and runs
    `node website/node_modules/tsx/dist/cli.mjs website/scripts/check-content.ts <file>`,
    with `website/` as the working directory. The path is the `tsx` bin in
    `package-lock.json`: `"tsx": "dist/cli.mjs"`.
  - **This run's lines** are the problem lines that contain the marker, or any id
    value the test itself sent. The ids are needed because the website's media
    line names the id, not the item (round 2). The test asserts there are none.
  - Why scoped: `DigitalHubContent_Test` is shared by the whole suite, and other
    tests' rows (some inserted straight into the database, 2.4) are not this test's
    subject. `renderWebConfig` stops at the first bad redirect, so other tests'
    redirects would hide this test's own.
  - Other lines are printed in the test output, not asserted.
- **Canary W2:** the same runner, on a hand-made bad file, must exit 1 with the
  expected messages. That proves the harness can fail (P-6). It needs no database.
- **If `website/node_modules` is missing, W1 and W2 fail** with "Run npm ci in
  website/ first." They never skip (P-5, P-6).
- **CI:** job `api` gets two steps before "Integration tests (Release)", written as
  job `website` writes them:
  - `actions/setup-node@v4` with `node-version: ${{ env.NODE_VERSION }}`,
    `cache: npm`, `cache-dependency-path: website/package-lock.json`;
  - `npm ci` with `working-directory: website`.

### 3.4 Why ADM-07's parts 1 and 2 are here, and part 3 is not

- **Parts 1 and 2 are the same comparison as ADM-02 part 1**, in the same four
  functions (`OccupiesLivePathAsync`, `CreateRedirectAsync`,
  `ResolveDestinationAsync`, `CheckRedirectAsync`). The audit says so: "Same root
  cause as ADM-02. Fix it with path normalisation".
  - Splitting them would put two pull requests on the same lines, one after the
    other.
  - It would leave `RedirectPaths.Key` used by some checks and not others, which is
    the defect itself.
  - They add four tests (R2, R3, R4, R5) and no code beyond 3.1.
- **Part 3 is a new feature, not a normalisation.** "A target that does not exist
  ... a target check that warns in the Studio and reports in the build" needs:
  - a rule for what a target is: a page path, a legacy `.html` path such as
    `RedirectPathRuleTests`' `/about-us.html`, or a folder;
  - a warning channel on `POST /api/v1/redirects`;
  - a change to `studio/src/pages/RedirectsPage.tsx`;
  - a build-side report in `website/`;
  - the `ToPath` comparisons in `ContentStore.DeleteAsync` and `RetargetAsync`
    (2.2);
  - Phase C 10.7 ("Every redirect in the table resolves to a page returning 200").
  That is a second module, with design choices of its own. It goes to the ADM-07
  change, next in the batch order.
- **ADM-07 is a Major, so its end-to-end test** ("The end-to-end suite gets a test
  for each Major") lands with the change that closes it. It covers all three parts.

### 3.5 Hand-over to ADM-01a

"Report a failed build in the Studio" is ADM-01a ("record build runs, each with its
content cutoff and result"). ADM-02 gives ADM-01a fewer failures to report.
ADM-01a records and shows what a build run itself prints. `check:content` is not a
substitute for that, because it runs only two of the build's checks (3.3). ADM-01a
decides how a run's result reaches the Studio. Nothing here touches the Studio.

### 3.6 Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Store the canonical form: strip the trailing slash on save | It changes what staff typed, and toPath `/x/` would silently become `/x`. It needs a data migration of existing rows, and that migration collides on the unique index when a pair already exists. Comparing by key fixes every check with no schema or data change |
| Add a database check constraint that refuses a trailing slash | A schema migration, the same collision, and it would refuse rows the build accepts |
| Switch on `RequireFormatValidation` with the library's own `uuid` | Its `uuid` accepts `" 0123…"` (2.3); the website refuses it |
| Match the website's format exactly (upper case allowed) | An upper-case id then publishes, stops the build (`mediaId`) or is silently dropped (reference) (2.3). That is review finding 2, option (b). Rejected because it leaves ADM-02's defect class open |
| Make the website's lookups case-insensitive instead | It changes the website's rendering code to accept a form the API never writes, and leaves two spellings of one id in published content. Refusing at the source fails closed and keeps one form |
| Register the format in `FormatRegistry.Global` | A process-wide side effect on every schema evaluation in the process and in tests. A per-options registry does the same job (2.3 probe) |
| Assert formats at save, or on every imported row | It turns two normal Studio flows into blocked saves with no Clear, and refuses ordinary drafts on import (3.2) |
| Check ids with `Guid.TryParse` in `PublishChecks` | Not the website's rule: `TryParse` accepts the 32-digit, brace, parenthesis and upper-case forms (2.3) |
| A committed fixture of "API output" fed to the website's tests | It would be API output from the day it was generated, so it cannot catch the next drift |
| Website job checks an `api` job artifact (`needs: api`) | It serialises the two longest CI jobs. One cached `npm ci` in `api` is cheaper |
| A full-build mode in `check:content` (routes, error pages) | It duplicates `prepare.ts` and `routes.ts` logic outside them. The API-source build is the full check (3.3) |
| Fix ADM-07 part 3 here | Section 3.4 |

## 4. Scope

### Files to create

| File | What |
| --- | --- |
| `api/src/DigitalHub.Api/Content/SchemaFormats.cs` | The website's `uuid` source text, the API's lower-case `Regex`, and the `Asserting()` and `Annotating()` option factories (3.2) |
| `website/src/content/check-content.ts` | `checkContent(content)`: `validateContent` plus `renderWebConfig`, as the build calls them (3.3) |
| `website/scripts/check-content.ts` | CLI around `checkContent`: problems on stdout and exit 1, or the pass line and exit 0 |
| `website/test/check-content.test.ts` | C1 to C5 (5.1) |
| `api/tests/DigitalHub.Api.Tests/RedirectAddressTests.cs` | R1 to R7 (database) |
| `api/tests/DigitalHub.Api.Tests/RedirectAddressRuleTests.cs` | K1 (DB-free drift guard for the address key) |
| `api/tests/DigitalHub.Api.Tests/SchemaFormatTests.cs` | F1 (DB-free), F2 to F4 (database) |
| `api/tests/DigitalHub.Api.Tests/ApiAcceptedContentTests.cs` | W1 (database) and W2 (DB-free canary) |

### Files to change

| File | What changes |
| --- | --- |
| `api/src/DigitalHub.Api/Content/RedirectPaths.cs` | Add `Key` and `Spellings`; the summary says the key is `web-config.ts`'s |
| `api/src/DigitalHub.Api/Content/AdminStore.cs` | `CreateRedirectAsync` (137, 140), `OccupiesLivePathAsync`, `ResolveDestinationAsync`, and `CheckRedirectAsync` with its new duplicate-address check, all use the key (3.1). Nothing else in the file |
| `api/src/DigitalHub.Api/Content/ContentStore.cs` | `CheckAsync` and `CheckDocumentAsync` gain `publishing`, which chooses `Validate` or `ValidateDraft`; `PublishAsync` passes `true`; the slug-is-a-redirect-source check (741) uses `Spellings`; `RetargetAsync`'s `FromPath` comparisons use the key (3.1, 3.2) |
| `api/src/DigitalHub.Api/Content/SectionSchemaSet.cs` | Two option sets: `Validate` asserts formats; the new `ValidateDraft` does not |
| `api/src/DigitalHub.Api/Content/CollectionSchemaSet.cs` | Same as `SectionSchemaSet` |
| `api/tools/DigitalHub.ContentImport/ContentBundle.cs` | **Moved in from out of scope in round 2.** `CheckAsync` passes `publishing: record.Status == ContentStatus.Published` for collection rows and `publishing: false` for working copies (3.2). Nothing else |
| `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs` | Two new facts, F5a and F5b (5.1), using the file's existing `SeedAsync`, `ExportAsync`, `Edit`, `EmptyAsync` and `ImportAsync` helpers. No existing test changes |
| `website/package.json` | The `"check:content"` script. No dependency change, and the lockfile is not touched (B-7) |
| `.github/workflows/ci.yml` | Job `api`: `actions/setup-node@v4` and `npm ci` in `website/`, before "Integration tests (Release)" (3.3). Nothing else |

### Out of scope (left alone on purpose)

- **ADM-07 part 3, to the ADM-07 change:** the target check, its Studio warning
  (`RedirectsPage.tsx`), its build report, the `ToPath` comparisons in
  `ContentStore.DeleteAsync` (250) and `RetargetAsync`, and ADM-07's end-to-end test.
- **ADM-02 part 4, to ADM-01a:** reporting a failed build in the Studio (3.5).
- **Rich-text ids** (`RichText.Validate`, `RichText.cs:402,598`), which accept
  upper-case and other `Guid.TryParse` forms (2.3). Proposed destination: a
  follow-up change, **ADM-02b, "Rich-text ids in the form the website looks up"**.
  It needs a coordinator slot, and the owner sees it in section 9. Reasons it is
  not in this change:
  - It is a different module from the schema check (B-8).
  - `RichText.Validate` runs at save as well as at publish, so the save-versus-publish
    question of 3.2 has to be answered again for it.
  - Neither Studio path produces such an id (2.3).
  - The website still stops the build on an upper-case rich-text `mediaId`, so the
    failure is loud, not silent. An upper-case `relatedItems` id is dropped
    silently; that is noted in 10.
- **The old-site importer** (`ContentWriter.cs`, `SectionPreview.cs`
  `SectionSchemas.Load()`, `--source <DH-WEBSITE-main> --apply`). Round 2, review
  finding 3. Reasons it is left alone:
  - It writes ids it generates or converts as `ToString("D")` (2.3). The only
    pass-through ids are `SectionFields.cs:272` (a media item's id read from the old
    site's media map) and `:753` (a reference id already in the converted form).
  - It is run by hand against `feature/interviewer-portal` content, which no CI job
    can open (`CLAUDE.md`: no agent opens a session in `DH-WEBSITE-main`). So a
    change to it could not be tested here or in CI.
  - Its stored-section check runs after it writes and only reports.
  - After such an import, the API-source website build (or `check:content` on the
    build content) stops on any id the website refuses.
  - Its risk row is corrected in section 10.
- **Readable schema and redirect messages:** ADM-09, ADM-14 and ADM-20. The Studio
  shows `problem.title` for a refused redirect behind the open modal
  (`RedirectsPage.tsx:76-80`). That belongs to ADM-14.
- **Clear controls for references and images:** ADM-09.
- **Error-page saves** (`AdminStore.UpdateErrorPageAsync`, 549-598): ADM-05. They
  hold rich text only.
- **Case of letters in redirect paths:** the database is already stricter than the
  build (2.2).
- **`ReferenceConverter.cs` (`--convert-references`)** is not changed. It calls
  `SectionSchemaSet.Validate` over stored sections, which now also reports format
  and case failures. That is the right answer for a stored-content check, and the
  tool writes, so it is not the detection tool in O-ADM02-2.
- **Every Studio file**, in particular `studio/src/content/RichTextEditor.tsx` and its
  tests (ADM-03, #52).
- **No migration** (section 7).

## 5. Test plan

### 5.1 Failing tests, written first

**Marker rule** (round 2, review finding 7). Each test makes one marker,
`m = "adm02-" + Guid.NewGuid().ToString("N")[..8]`. Every redirect path, slug and
title in R1 to R7, F2 to F5 and W1 starts with it. In the tables, `/m-x` means
`/<m>-x` and `<m>-bad` means a slug starting with the marker. No test uses a fixed
path or slug, so a failed cleanup cannot collide with the next run on
`IX_redirects_from_path` or a slug index.

Database tests are `[Collection("SqlServer")]` with `IClassFixture<ApiFactory>`.
They log in as the admin (`AuthSession.LoginAsync`) and delete what they create in
a `finally` block:

- redirects through `DELETE /api/v1/redirects/{id}`;
- items unpublished, then deleted, as `AdminApiTests` does;
- media through the media delete route, as `MediaLibraryTests` does.

Rows inserted straight into the database are removed the way `ContentPublishTests`
removes them. The bundle tests (F5) run inside `ContentBundleTests.InTransactionAsync`,
which rolls back.

**`RedirectAddressTests.cs` (database).**

| # | Test | Asserts | Red at base (from 2.2) | Green |
| --- | --- | --- | --- | --- |
| R1 | `A_trailing_slash_does_not_make_a_second_redirect` [Theory: (`/m`, `/m/`), (`/m/`, `/m`)] | First POST 201; second POST `409`, code `redirect_exists`; `GET /api/v1/redirects?search=<m>` total 1 | Second POST 201, total 2 | As asserted |
| R2 | `A_redirect_to_its_own_address_is_refused_with_or_without_a_slash` [Theory: (`/m-a`, `/m-a/`), (`/m-a/`, `/m-a`)] | `400 redirect_loop` | 201 | As asserted |
| R3 | `Loops_and_chains_are_seen_through_a_trailing_slash` | With `/m-p → /m-q`: `/m-q/ → /m-p/` is `400 redirect_loop`; `/m-c → /m-p/` is 201 with `toPath` `/m-q` | 201, then `toPath` `/m-p/` | As asserted |
| R4 | `A_redirect_cannot_take_over_a_live_address_with_a_trailing_slash` [Theory: `pages` `/<slug>/`, `case-studies` `/cases/<slug>/`, `blog-posts` `/blogs/<slug>/`] | Publish the item (as `BuildContentTests.DescribeAsync` and `ContentPublishTests` do), then POST that path with a slash: `400 redirect_live_path` | 201, the audit's `/blogs/<live-slug>/` | As asserted |
| R5 | `Publishing_is_refused_where_a_redirect_with_a_slash_starts` | Draft page `<m>`; POST `/<m>/ → /m-elsewhere` is 201 (the page is not live yet); publish the page: `400 publish_blocked`, body contains "source of a redirect" | Publish 200, and the redirect takes over the page | As asserted |
| R6 | `A_rename_reuses_the_redirect_that_starts_at_the_old_address_with_a_slash` | Publish page `<m>`; insert through `ContentDbContext` a legacy row `/<m>/ → /m-x`; rename to `<m>-new` and publish; exactly one row has key `/<m>`, and its `ToPath` is `/<m>-new` | Two rows, `/<m>/` and `/<m>`: the build fails with "Two redirects start at /<m>/." | As asserted |
| R7 | `The_import_check_refuses_a_shared_address_and_a_self_redirect` | Insert `/m-i`, `/m-i/` and `/m-j → /m-j/` through `ContentDbContext`; `AdminStore.CheckRedirectAsync(db, row)` returns a `fromPath` error for `/m-i/` and a `toPath` error for `/m-j → /m-j/` | No errors | As asserted |

R5's publish refusal holds at save too (3.1). R5 asserts publish, the case the
audit names. The save case is covered by the existing
`ContentPublishTests.Slug_cannot_match_a_redirect_source`, whose exact path still
applies, and by B4.

**`RedirectAddressRuleTests.cs` (DB-free, no fixture).**

| # | Test | Asserts |
| --- | --- | --- |
| K1 | `The_api_address_is_the_website_builds_address` | `web-config.ts` still contains `row.fromPath.replace(/\/+$/, "") \|\| "/"` in `redirectRules` and `fromPath.slice(1).replace(/\/+$/, "")` in `matchPattern` (the file is found as `RedirectPathRuleTests.WebConfigSource` finds it). `RedirectPaths.Key` maps `/`→`/`, `/x`→`/x`, `/x/`→`/x`, `/a/b/`→`/a/b`. `Spellings` gives `["/"]` and `["/x", "/x/"]` |

K1 names `RedirectPaths.Key`, which does not exist at the base, so it cannot be in
the red commit without breaking the test build. It is a drift guard, not the
regression test, and it lands with the fix (5.2). R1 to R7 are the regression tests.

**`SchemaFormatTests.cs`.** A valid reference target is a case study `<m>-target`,
published as `BuildContentTests` publishes one. A valid media item is uploaded as
`MediaLibraryTests.UploadAsync` does, with alt text.

| # | Test | Asserts | Red at base | Green |
| --- | --- | --- | --- | --- |
| F1 | `The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case` (DB-free; reads files, constructs `new SectionSchemaSet()`) | (a) `validate.ts` has exactly one `addFormat`, and it is `ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);`, compared with a literal in the test, so F1 compiles at the base. Commit 3 adds one assertion that `SchemaFormats.WebsiteUuidSource` equals the same literal. (b) The `"format"` values in `packages/sections/*.json` and `packages/collections/*.json` are exactly `{ "uuid" }`. (c) For each case, `Validate("case_cards", <reference id = case>)` has errors exactly when the website refuses it **or** the case has an upper-case letter. Cases, with the website's verdict (2.3, Node) and the API's: lower-case valid ✓/✓, upper-case valid ✓/✗, `not-a-uuid` ✗/✗, `""` ✗/✗, 32-digit ✗/✗, braces ✗/✗, leading space ✗/✗, trailing `\n` ✗/✗, full-width digit ✗/✗. (d) Whenever the website refuses, the API refuses | (c) fails: `not-a-uuid` gets no error (2.3 probe) | Passes |
| F2 | `Publishing_refuses_an_id_the_website_would_refuse` [Theory over `case_cards`: `items[0].reference` = `{ type: "case_study", id: "not-a-uuid" }`, `{ type: "case_study", id: "" }`, `{ type: "case_study", id: <target id, 32-digit form> }`; `items[0].image` = `{ mediaId: "not-a-uuid", alt: "A", decorative: false }`; and `related_items` `items[0]` = `{ type: "case_study", id: "not-a-uuid", title: "T", text: "T" }`] | Save is 200; publish is `400 publish_blocked`, and the body contains `format 'uuid'` | Publish 200 | As asserted |
| F3 | `A_draft_with_an_unchosen_reference_or_image_still_saves` [Theory: `reference` `{ type: "service", id: "" }`; `image` `{ mediaId: "", alt: "A", decorative: false }`] | Save is 200 (3.2) | Passes (guard) | Passes |
| F4 | `Publishing_refuses_an_upper_case_id` [Theory: `reference` `{ type: "case_study", id: <target id in upper case> }`; `image` `{ mediaId: <uploaded media id in upper case>, alt: "A", decorative: false }`] | Save is 200; publish is `400 publish_blocked`, and the body contains `format 'uuid'`. **Reframed in round 2:** it was a guard that upper case publishes. Now it is a regression test that upper case is refused (3.2) | Publish 200: the API finds both ids case-insensitively (2.3) | As asserted |

**`ContentBundleTests.cs`, two new facts** (round 2, review finding 1). Both use the
file's seed: published page `PageId` with one section, and a working copy of
published case study `CaseId`.

| # | Test | Asserts | Red at base | Green |
| --- | --- | --- | --- | --- |
| F5a | `A_published_row_with_an_id_the_website_would_refuse_is_not_imported` | `Edit` the exported bundle: `sections[0]` gets `type` `case_cards` and fields `{ heading: "H", items: [{ title: "T", reference: { type: "case_study", id: "not-a-uuid" } }] }`. `EmptyAsync`, then `ImportAsync`. `result.Ok` is false. A problem starts with `pages <PageId>: sections[0]` and contains `format 'uuid'`. Nothing is imported (`db.Pages.CountAsync() == 0`) | Imports (`Ok` true) | As asserted |
| F5b | `A_draft_row_or_working_copy_with_an_unchosen_id_still_imports` | The same section with `id: ""`, the page row's `status` set to `draft`, and the working copy's document given a `case_cards` section with `image` `{ mediaId: "", alt: "A", decorative: false }`. `result.Ok` is true | Passes (guard) | Passes. Fails if the import were strict on drafts, which was round 1's defect |

**`ApiAcceptedContentTests.cs`.**

| # | Test | Asserts | Red at base | Green |
| --- | --- | --- | --- | --- |
| W1 | `Content_the_api_accepted_passes_the_website_checks` (database, Node) | Through the API, without asserting the API's answers: create `/m-x` and `/m-x/`; publish page `<m>-bad` with a `case_cards` reference id `not-a-uuid`; publish page `<m>-upper` with `image` `{ mediaId: <uploaded media id in upper case>, alt: "A", decorative: false }`; publish page `<m>-good` with a reference to the published case study `<m>-target`. Then build the scoped file (3.3) and run the website's check. There are no "this run's lines" (3.3). The exit code is 0 if there is no line at all | Exit 1. The lines: `Two redirects start at /m-x/.`; `pages/<m>-bad: section 1 (case_cards) does not match sections/case_cards.json: /items/0/reference/id must match format "uuid"`; `Media <UPPER-ID> is used by published content but is not in the media list.` | No such lines: the API refused all three (409, 400, 400) |
| W2 | `The_website_check_fails_on_a_bad_file` (DB-free, Node) | The runner, on the committed snapshot's `content.json` plus redirects `/x` and `/x/` and one page whose `case_cards` reference id is `not-a-uuid`, exits 1 with both messages | Passes (canary) | Passes |

**`website/test/check-content.test.ts` (vitest).**

| # | Test | Asserts |
| --- | --- | --- |
| C1 | `passes the committed snapshot` | `checkContent(snapshot)` is `[]` |
| C2 | `refuses two redirects that differ by a trailing slash` | Contains `Two redirects start at /x/.` |
| C3 | `refuses a section reference id that is not a uuid` | Contains a line with `must match format "uuid"` |
| C4 | `stops on an upper-case media id` (round 2) | The snapshot, with one section's `mediaId` replaced by the upper-case form of a snapshot media id (for example `6123DCD6-0182-548F-A41B-66B8245F751C`), gives `Media 6123DCD6-… is used by published content but is not in the media list.` |
| C5 | `drops an upper-case reference without a problem line` (round 2, characterisation) | `checkContent` passes the snapshot with a reference id in upper case, and `createSite(content).resolve(reference)` is `null`. This records why the API refuses upper case (3.2). It is not a website rule to keep |

At commit 1, C1 to C5, F3, F5b and W2 pass. They test the website's existing checks,
the harness, and the drafts the design keeps. Because they pass, W1's red means
"the API accepted it", not "the harness is broken".

### 5.2 Commit order (B-6, P-4)

1. `ADM-02: Test that API-accepted content passes the website's checks`
   - All test files except `RedirectAddressRuleTests.cs`, and the two facts in
     `ContentBundleTests.cs`.
   - The harness: `website/src/content/check-content.ts`,
     `website/scripts/check-content.ts`, the `package.json` script, and the
     `ci.yml` steps.
   - No change under `api/src/` or `api/tools/`. The harness adds no product
     behaviour: it runs the website's own checks.
   - F1 compiles at the base: part (a) compares `validate.ts` with a literal, and
     (c) calls the existing `SectionSchemaSet.Validate`. It does not name
     `SchemaFormats`, which does not exist yet.
2. `ADM-02: Compare redirect addresses as the website build does`
   - `RedirectPaths.cs`, `AdminStore.cs`, the redirect parts of `ContentStore.cs`,
     and `RedirectAddressRuleTests.cs` (K1).
   - Makes R1 to R7 green.
3. `ADM-02: Assert lower-case uuids on published rows, at publish and import`
   - `SchemaFormats.cs`, `SectionSchemaSet.cs`, `CollectionSchemaSet.cs`, the
     `publishing` part of `ContentStore.cs`, and `ContentBundle.cs`.
   - Also one assertion added to F1: `SchemaFormats.WebsiteUuidSource` equals F1's
     literal. This ties the API constant to the website's text, as K1 does for
     redirects.
   - Makes F1, F2, F4, F5a and W1 green.

Commits 2 and 3 can be reverted separately.

### 5.3 Local evidence, in this container

Set up:

```bash
. /tmp/claude-0/-home-user-DH-WEBSITE/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/dn.sh
cd /home/user/dh-change-adm02/api
export CS="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True"
```

Port 4299 has no listener, and `ApiFactory` rewrites the catalog to
`DigitalHubContent_Test`. No database is touched. Use a fresh `HOME` for each run.
The developer runs `npm ci` in `website/` from the unchanged lockfile, for W2 and
C1 to C5.

**After commit 1 (red):**

```bash
dotnet build DigitalHub.slnx -c Release
HOME=<fresh> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build \
  --filter "FullyQualifiedName~DigitalHub.Api.Tests.SchemaFormatTests.The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case|FullyQualifiedName~DigitalHub.Api.Tests.ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file"
cd ../website && npx vitest run test/check-content.test.ts && npm run typecheck
```

- Expected: F1 fails at (c), quoted as run (`not-a-uuid` gets no API error). W2
  passes. C1 to C5 pass. Typecheck passes.
- R1 to R7, F2 to F5 and W1 need SQL Server. Locally they fail on the connection,
  which is not the red. They are NOT RUN here; CI job `api` covers them (5.4).

**After commits 2 and 3 (green):**

- The same commands, plus K1. Expected: F1, K1, W2 and C1 to C5 pass.
- Full API suite without a database:
  `HOME=<fresh> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --logger "trx;LogFileName=<scratch>/adm02-after.trx"`.
  - Diff the passed names against
    `/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm02/base-passed.txt`
    (173 names at `77296ba`).
  - Expected: all 173 still pass, plus F1, K1 and W2. Any name that passed and now
    fails is a regression, to be reported before anything else.
- `dotnet build DigitalHub.slnx -c Release`: 0 errors, and no more than the 13
  warnings of 2.4. The solution includes `DigitalHub.ContentImport`, so this also
  builds `ContentBundle.cs`.
- `cd website && npm run typecheck && npx vitest run`: all pass.

### 5.4 CI evidence on the pull request

- **Red, job `api`, at commit 1.** This waits on O-ADM02-1. Expected failing tests,
  and nothing else:
  - R1 (2 cases), R2 (2), R3, R4 (3), R5, R6, R7: 11;
  - F1, F2 (5 cases), F4 (2), F5a: 9;
  - W1: 1.

  That is 21 in all, and 20 of them need SQL Server (all but F1). F3 (2), F5b and
  W2 pass. Quote each failure's assertion. W1's output must show the three lines
  in 5.1.
- **Green, every job of `ci.yml` on the final head:**
  - `api`: all tests pass. Quote the count from the TRX: the base's total plus the
    new ones.
  - `website`, `studio` (unit and end-to-end), `section-compare`, `website-browser`;
  - `workflow-lint.yml` (actionlint) on the changed `ci.yml`;
  - `security.yml`.
- **Watch** the `studio` end-to-end test 10.21 (`studio.spec.ts:163`). It picks a
  reference and saves, and save is unchanged, so it must stay green. Also watch the
  existing `ContentBundleTests`: the seed's ids are `Guid`s in `"D"` form, so none
  should change.

### 5.5 Track checklist (G3), from `docs/changes/README.md`

| Item | How it is met |
| --- | --- |
| The finding, its evidence and its fix come from the audit | Section 1 quotes ADM-02 and ADM-07. 2.2 and 2.3 reproduce what can run here. The fix is the audit's: "Normalise paths in every redirect check", "Enforce the same formats in the API" (made stricter on case, 3.2), and "Add a test that feeds API-accepted content to the website's checks" |
| The regression test is committed and shown failing before the fix | Commit 1 comes before commits 2 and 3. F1 is red locally. The other 20 are red in CI only if O-ADM02-1 is "Yes". If it is "No", this row is not met: the delivery is BLOCKED ON OWNER until the owner accepts NOT RUN red in words (a D-NNN entry). No role may waive it (P-7) |
| The end-to-end suite gets a test for each Major | ADM-02 is a Blocker. ADM-07 (Major) is only partly closed here, and its end-to-end test lands with the ADM-07 change (3.4) |
| A Minor that is not fixed becomes a D-NNN entry | Not a Minor |
| G3-1 exit gate: "each blocker reproduced before its fix and passing after it" | Reproduced in 2.2, 2.3 and the CI red (5.4). Passing in 5.3 and 5.4 |
| G3-1 exit gate: "A clean website build from `DigitalHubContent_Studio` with no patched content" | Not met by this change alone. It needs O-ADM02-2 (existing rows) and ADM-05 (error pages, `prepare.ts:44-47`) |

## 6. Security impact

- **Routes and policies:** none changed. `POST /api/v1/redirects` and the content
  save and publish routes keep their policies.
- **Input validation:** stronger (A-5).
  - Redirects that would loop, take over a live page, or share an address are
    refused, so they can no longer reach `web.config`.
  - Published content, in the API and in the bundle import, must hold lower-case
    UUIDs where the schema says `uuid`.
  - Nothing that is refused today becomes accepted. Comparing by key only adds
    matches.
  - The new regular expression is anchored and linear: no backtracking risk.
- **Data:** no schema or data change. No row is rewritten.
- **Logins and secrets:**
  - W1 uses the test build token `ApiFactory.BuildTokenValue`, which is already in
    the test project.
  - The temporary file holds only test content and is deleted in `finally`.
- **Dependencies and supply chain:**
  - No new package.
  - Job `api` now runs `npm ci` from `website/package-lock.json`, which job
    `website` already runs, in a job that has the CI-only SQL Server passwords
    already written in `ci.yml`. Those are not secrets.
  - Actions stay `@v4`, like the rest of `ci.yml`. Pinning by SHA is G1 work.
- **Child process:** W1 and W2 start `node` with fixed arguments and a file path the
  test generated. Nothing from outside the test reaches the command line.

## 7. Migrations

None. No entity, column, index or constraint changes, and no data is rewritten (3.6
says why storage is not canonicalised).

**Existing rows that become invalid, and what each now does:**

- **Redirect pairs that share an address.** The build already fails on them. The
  API now refuses new ones, but the existing rows must be removed.
- **Self-redirects** (`/a → /a/`). They still build and still loop.
- **Redirects that start at a live page with a slash.** They still build and still
  take the page over. **And the live page can no longer be saved**, in any field or
  section, until the redirect is deleted: "That address is the source of a
  redirect." (3.1, B4). Staff will meet this first. It is the reason O-ADM02-2
  lists these rows by page as well as by redirect.
- **Published items holding a non-`uuid` or upper-case id.**
  - They still stop the build (non-`uuid` values and upper-case media ids), or
    lose a link silently (upper-case references).
  - Their next publish is refused until the id is fixed. Their next save is not
    refused (3.2).
  - A bundle export of the catalog cannot be imported elsewhere while they remain
    (F5a). Drafts and working copies still import (F5b).

The audit run was against `DigitalHubContent_Studio`, so some of these rows are
probably there. That is not verified: there is no SQL Server here. The handling is
O-ADM02-2. None of it is a migration.

## 8. Rollback

- Revert the pull request. Nothing is stored differently, so nothing needs cleaning
  up.
- Commits 2 (redirects) and 3 (formats) can be reverted separately.
- After a revert, content saved under the new rules is still valid under the old
  ones, because the new rules only refuse more.
- If the `ci.yml` step alone causes trouble, reverting the whole pull request is the
  rollback. W1 cannot pass without it (P-6).

## 9. Owner decisions needed

- **O-ADM02-1. Status: PENDING.** The coordinator has put it to the owner as a card
  (11 November 2026). No answer has been given, and none is assumed.
  - **Question:** "May the developer push ADM-02's first commit (tests and the
    website check harness only) to `change/ADM-02` and open the pull request before
    the fix commits are pushed, so that CI's `api` job shows the redirect, format,
    import and API-to-website tests failing first? CI would be red on that pull
    request until the rest is pushed."
  - **Answers to offer:** "Yes, push the red tests first" (recommended), or "No,
    push only when finished".
  - **Not assumed from earlier changes.** The owner answered the same question for
    ADM-06b ("Yes, red test first like #49", Mohamed Elbadry, 11 November 2026, as
    quoted in the ADM-03 plan). Those words cover ADM-06b, not ADM-02.
  - **Why it is asked:** the G3 rule requires the regression test "shown failing
    before the fix". 20 of the 21 red cases in 5.4 need SQL Server, which this
    container lacks, and CI runs only on a pull request.
  - **What does not wait:** development, the commits in order, the local evidence
    (5.3), the review, testing and both gates.
  - **If "No":** the red for those 20 cases is NOT RUN. The delivery is then BLOCKED
    ON OWNER until the owner either accepts that in words or changes the answer.
    Acceptance is a D-NNN entry in `docs/deferred-items.md` with:
    - the rule waived;
    - the reason;
    - the owner's words and the date;
    - the follow-up owner;
    - an expiry.

- **O-ADM02-2. Status: PENDING.** What happens to the rows in
  `DigitalHubContent_Studio` that the new rules refuse (section 7).
  - **Question:** "After ADM-02 merges, may an agent you name list, read-only, the
    redirects and published items in `DigitalHubContent_Studio` that the new rules
    refuse, and show you the list? Then, for each one, you (or an agent you name)
    fix it through the Studio: delete the redirect, or pick the item or image again
    and publish. Do Studio fixes like these count as 'no patched content' for the
    G3-1 exit gate?"
  - **Answers to offer:**
    - "Yes, list them; I choose the fixes; fixes through the Studio count"
      (recommended);
    - "Yes, list them, and delete the audit's test redirects without asking";
    - "No, leave the database as it is".
  - **Why recommended:**
    - The fixes go through the product, so each one is audited, and none is a hand
      edit.
    - No migration has to guess which of two redirects to keep.
    - The build fails on any such pair, so nothing live depends on either row.
  - **The read-only list** (no writes, one agent at a time):
    - **(a) Redirects that share an address or point at themselves.** A `SELECT`
      only:
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
    - **(b) Live pages that a redirect takes over** (added in round 2, review
      finding 4). These pages also cannot be saved after ADM-02. A `SELECT` only.
      The addresses are `ContentPaths.PublicPath`'s; `status` is stored in lower
      case (`ContentModelBuilder.cs:224-227`):
      ```sql
      WITH live AS (
        SELECT 'pages' AS collection, id, slug,
               CASE slug WHEN 'home' THEN '/' WHEN 'apply' THEN '/careers/apply' ELSE '/' + slug END AS path
          FROM dbo.pages WHERE status = 'published'
        UNION ALL SELECT 'services', id, slug, '/services/' + slug FROM dbo.services WHERE status = 'published'
        UNION ALL SELECT 'partners', id, slug, '/partners/' + slug FROM dbo.partners WHERE status = 'published'
        UNION ALL SELECT 'case-studies', id, slug, '/cases/' + slug FROM dbo.case_studies WHERE status = 'published'
        UNION ALL SELECT 'blog-posts', id, slug, '/blogs/' + slug FROM dbo.blog_posts WHERE status = 'published'
        UNION ALL SELECT 'vacancies', id, slug, '/careers/' + slug FROM dbo.vacancies WHERE status = 'published')
      SELECT l.collection, l.id AS item_id, l.slug, r.id AS redirect_id, r.from_path, r.to_path
      FROM dbo.redirects r
      JOIN live l ON r.from_path IN (l.path, l.path + '/')
      ORDER BY l.collection, l.slug;
      ```
    - **(c) Published ids the website refuses or cannot look up.** Run
      `npm run check:content -- <file>` on the response of `GET /api/v1/build/content`
      from an API running against `DigitalHubContent_Studio` (a read).
      - It reports what the website's schema, media and redirect checks stop on:
        shared addresses, non-`uuid` ids and upper-case media ids.
      - It does not report upper-case references, which the website drops
        silently, or the route and error-page checks (3.3).
      - The G3-1 exit-gate build is still the full check.
    - **(d) Optional, the product's own checks on every row.**
      - Export a bundle with `DigitalHub.ContentImport export --database DigitalHubContent_Studio`
        (a read).
      - Then run `import --dry-run` on it into a freshly reset `DigitalHubContent_Test`.
        The dry run applies the fixed `CheckRedirectAsync`, the slug check and the
        strict check on published rows, including upper-case references. It
        changes nothing it imports.
      - It does reset a shared test catalog (one agent at a time), so it needs the
        owner's go-ahead.
  - **What does not wait:** this change's development, review, tests and merge.
    Only the G3-1 exit-gate build waits on it (and on ADM-05).

- **Behaviour changes, for the owner to see.** They go in the pull request body too.
  They are the fix itself, so they are not asked as separate decisions. Say so
  before gate 1 if any is not wanted.
  - **B1:** A redirect whose from path differs from an existing one only by a
    trailing slash is refused, `409 redirect_exists`. Today it is 201, and the
    build stops.
  - **B2:** A redirect from `/a` to `/a/`, or the reverse, is refused,
    `400 redirect_loop`. Today it is 201, and the site loops.
  - **B3:** A redirect from a live page's address with a trailing slash is refused,
    `400 redirect_live_path`. Today it is 201, and the page answers 301.
  - **B4 (widened in round 2):** **Saving or publishing** an item whose address is
    where a redirect with a trailing slash starts is refused: `400` on save, and
    `400 publish_blocked` on publish, with "That address is the source of a
    redirect." Today the publish goes through and the redirect takes the page over.
    A page that is already live and has such a redirect can no longer be edited
    until the redirect is deleted (section 7).
  - **B5:** A redirect to `/p/`, when `/p` already redirects to `/q`, is stored as
    `/q` (chains collapse, design 4.5). Today it is stored as `/p/`.
  - **B6 (reworded in round 2):** Publishing refuses a schema `uuid` value that is
    not a lower-case UUID. So does importing a bundle, for **published rows only**.
    The message is the schema's.
    - This includes an empty id left by changing a reference's type, and an empty
      media id left by typing alt text before choosing an image.
    - Today it publishes, and the build stops.
    - Saving such a draft is still allowed. Draft rows and working copies in a
      bundle still import.
  - **B7 (new in round 2):** That rule includes upper case. An id such as
    `01234567-89AB-CDEF-0123-456789ABCDEF` is refused at publish and on a published
    import row, although the website's format check alone would accept it. Today
    it publishes, and then the build stops (`mediaId`) or the link silently
    disappears (reference). The Studio never produces upper case.

- **Noted, not decisions.**
  - ADM-07 is split: parts 1 and 2 are here, and part 3 with its end-to-end test is
    in the ADM-07 change (3.4). If the owner wants all of ADM-07 in one pull
    request, say so before gate 1.
  - **ADM-02b is proposed:** rich-text ids in the form the website looks up
    (section 4, "Out of scope"). It adds one pull request to slot 2, and it needs
    the coordinator to schedule it. If the owner prefers it inside ADM-02, say so
    before gate 1. It would add one file (`RichText.cs`) and the save-or-publish
    question for rich text.

## 10. Risks

| Risk | Effect | Caught by |
| --- | --- | --- |
| The API and the website disagree on something other than `uuid` | W1 shows a "this run's line" other than the three planned | W1 prints every problem line. The developer reports it and stops (BACK TO ARCHITECT); the scope is not widened silently |
| Another test's rows break the website's check on the shared test database | Problem lines that are not this run's | Printed, not asserted (3.3). Reported to the coordinator as a finding for its own change |
| `website/node_modules` is missing in the `api` job, or `tsx`'s bin path changes | W1 and W2 fail | They fail closed with "Run npm ci in website/ first". W2 is the canary that the runner can both fail and pass |
| The asserting options miss definitions reached through `$ref` (`defs.json`) | The format is not checked inside a reference or a media field | F1 uses `case_cards`, whose reference and image are both `$ref`s into `defs.json`. F2 covers three paths |
| .NET `$` before a newline | A `uuid` with a trailing newline is accepted | `\z` in the pattern; F1's trailing-`\n` case |
| The global format registry changes for other code | Other evaluations change | A per-options registry only (3.2); the 173-name DB-free baseline diff (5.3) |
| The import is strict on drafts | A catalog with an ordinary unfinished draft cannot be moved | `publishing` from the row's `Status`; F5b is red if drafts or working copies were strict |
| An existing test publishes, or a seed imports, a published non-UUID or upper-case id | That test turns red | grep found none: the only ids outside `"D"` form are in rich-text bodies, which are not schema fields. CI `api` is the check, and any such failure is reported, not "fixed" by loosening (P-6) |
| **Corrected in round 2.** The old-site importer (`ContentWriter`) publishes rows without the strict check | A published id the website refuses could still arrive through that tool | It writes generated or converted ids as `ToString("D")`, apart from two pass-through spots (section 4). It is run by hand and only reports. After such an import, the API-source build or `check:content` stops on any id the website refuses. Left out of scope, with that reason |
| Upper-case ids inside rich-text bodies | `mediaId`: the build stops, loudly. `relatedItems` id: the related item is silently dropped | Not fixed here: ADM-02b (section 4). Neither Studio path produces them (2.3). Shown to the owner (section 9) |
| A live page with a legacy slash redirect cannot be saved | Staff are blocked on that page until the redirect is deleted | B4 and section 7. O-ADM02-2 (b) lists those pages first |
| SQL `IN` misses a row because of the case-insensitive collation | It cannot: the collation makes more rows match, never fewer | R1 to R7 |
| Studio users meet the new publish refusal with a raw message | Confusion | B6 and B7 are shown to the owner. Readable messages are ADM-09 and ADM-20 |
| ADM-07 part 3 waits | Redirects to targets that do not exist can still be built | Out of scope, with a destination. The ADM-07 change is next in the batch order |
| The exit gate also needs the existing rows fixed and ADM-05 | G3-1 cannot close on ADM-02 alone | O-ADM02-2; stated in 5.5 |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `/x/` and `/x` are no longer both accepted | Audit ADM-02, bullet 1 | Planned | |
| Redirect paths are compared by the build's address key in every redirect check: create (duplicate, self), live path, loop and chain, import check, slug is a source (save and publish), rename | Audit ADM-02, Fix 1 | Planned | |
| The API key is locked to `web-config.ts`'s key (drift guard) | Audit ADM-02, bullet 1 (AdminStore against web-config) | Planned | |
| A non-UUID section reference id is not published | Audit ADM-02, bullet 2 | Planned | |
| The API asserts the build's `uuid` format, lower case only, at publish | Audit ADM-02, Fix 2; review round 1 finding 2 | Planned | |
| The bundle import is strict on published rows only; drafts and working copies still import | Audit ADM-02, Fix 2; review round 1 finding 1 | Planned | |
| The API's format rule is locked to `validate.ts` (drift guard) | Audit ADM-02, Fix 2 | Planned | |
| A test feeds API-accepted content to the website's checks | Audit ADM-02, Fix 3 | Planned | |
| Report a failed build in the Studio | Audit ADM-02, Fix 4 | Moved to ADM-01a | |
| `/blogs/<live-slug>/` (a trailing slash on a live address) is refused | Audit ADM-07, bullet 1 | Planned | |
| `/a → /a/` is refused | Audit ADM-07, bullet 2 | Planned | |
| A target that does not exist: Studio warning and build report (Phase C 10.7) | Audit ADM-07, bullet 3 | Moved to ADM-07 | |
| Redirect `ToPath` comparisons on delete and rename | Found here (2.2) | Moved to ADM-07 | |
| End-to-end test for the Major | G3 checklist, ADM-07 | Moved to ADM-07 | |
| Rich-text ids in the form the website looks up | Found here, round 2 (2.3) | Moved to ADM-02b (proposed; the coordinator schedules it, and the owner sees it) | |
| The old-site importer's schema check | Review round 1 finding 3 | Out of scope, with the reason (section 4) | |
| Existing rows that the new rules refuse are listed and fixed, including live pages that can no longer be saved | Found here (section 7); review round 1 finding 4 | Planned (waits on O-ADM02-2) | |
| Regression tests committed and shown failing before the fix | G3 checklist; refinement plan Track G3 | Planned (the CI red waits on O-ADM02-1) | |
| No regression in the DB-free baseline (173 names at `77296ba`) | P-8 | Planned | |

## 12. Revision log

- **Round 1 (11 November 2026, `84bf73a`):** first version.
- **Round 2 (11 November 2026):** answers `plan-review.md` Round 1 (`7f67959`, CHANGES
  NEEDED). Each finding, and how it is answered:
  - **Finding 1, Major: the bundle import would be strict on drafts and working
    copies.**
    - Accepted. `CheckDocumentAsync` gains `publishing`. `ContentBundle.CheckAsync`
      sets it from `record.Status == ContentStatus.Published` for collection rows,
      and `false` for working copies (3.2).
    - `ContentBundle.cs` moves to "Files to change", and `ContentBundleTests.cs`
      gains F5a (a published row with `not-a-uuid` is refused) and F5b (a draft row
      and a working copy with empty ids import).
    - B6 now names published rows. O-ADM02-2 (d) reports only what a build would
      see.
  - **Finding 2, Major: upper-case ids pass the format but break the website's
    exact lookups.**
    - Option (a), as the integrator preferred. The API's `uuid` is the website's
      pattern without `/i`, asserted on published rows (3.2). I found no strong
      reason against: nothing in the Studio or the old-site importer writes upper
      case (2.3), and being stricter cannot break a build.
    - F1 (c) now expects upper case to be refused, and (d) adds that every website
      refusal is an API refusal.
    - F4 is reframed from a guard into a regression test (`Publishing_refuses_an_upper_case_id`,
      reference and media).
    - W1 gains an upper-case `mediaId` page, and its "this run's lines" now include
      the ids the test sent, because the website's media line names the id. The
      website tests gain C4 (an upper-case media id stops the build) and C5 (an
      upper-case reference is silently dropped).
    - B7 is added. Section 10 states the residual risk: upper-case ids in rich-text
      bodies, which go to the proposed ADM-02b with the reasons in section 4.
  - **Finding 3, Minor: the old-site importer publishes without the strict check.**
    - The risk row is corrected. The importer is listed under "Out of scope" with
      the reason: its ids are generated or converted as `"D"`, it is run by hand
      against a source no CI job can open, its check only reports, and the website
      check on the built content still catches anything else.
  - **Finding 4, Minor: the slug check also applies at save.**
    - B4 now says "saving or publishing". Section 3.1 explains the save path, and
      section 7 lists live pages with a slash redirect as unable to be saved until
      the redirect is deleted.
    - O-ADM02-2 gains query (b), which lists those pages read-only. The dry run (d)
      also finds them.
  - **Finding 5, Minor: F2's media fixture lacked `decorative`.**
    - Every media value in F2, F3, F4, F5b and W1 is now written in full:
      `{ mediaId, alt: "A", decorative: false }`. The `related_items` row is
      written in full too.
  - **Finding 6, Minor: `check:content` was described as a whole build.**
    - The wording is corrected in 3.3, 3.5 and O-ADM02-2 (c). It runs the schema,
      media and redirect checks only, and its pass line says so.
    - A full mode is rejected in 3.6: the API-source build is the full check, and
      the exit gate runs it.
  - **Finding 7, Minor: the run markers in test paths.**
    - 5.1 opens with the marker rule. Every path, slug and title in R1 to R7, F2 to
      F5 and W1 starts with the run's marker, and `/m-x` means `/<m>-x`. W1's filter
      is "from path starts with `/<marker>`".
  - **Also changed:**
    - The red counts are now 21 cases in CI, 20 of them needing SQL Server
      (O-ADM02-1, 5.4).
    - O-ADM02-1 records that the coordinator's card is with the owner, still
      PENDING.
    - Commit 3 now includes `ContentBundle.cs`.
    - The coverage table gains the import, upper-case, rich-text (ADM-02b) and
      old-site importer rows.
