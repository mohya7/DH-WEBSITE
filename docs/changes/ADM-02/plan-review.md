# ADM-02: plan review

## Round 1

Reviewer: plan-reviewer, 11 November 2026. Plan reviewed: `docs/changes/ADM-02/plan.md`
at `84bf73a` on `change/ADM-02` (base `77296ba`). This is the first review, and there
is no earlier `plan-review.md`.

What I read: `docs/changes/README.md`, `AGENTS.md`/`CLAUDE.md`,
`ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md` (both through
`git show origin/claude/cool-heisenberg-mh6zx9:<path>`), the refinement plan and the
admin audit (`/mnt/project-files/docs/quality/`). ADR 0001 is not on the base. It is
G2 only and does not apply to this change.

How I checked: I ran read-only commands in the worktree (`git`, `grep`, `sed`) and
`gh api` for the open pull requests. I ran a `node -e` probe of the website's `uuid`
expression and of its redirect key, and re-ran the architect's .NET regex probe
(`scratchpad/adm02/fmt`, Release). I read the JsonSchema.Net 8.0.5 XML docs in the
local NuGet cache. There is no SQL Server, so I ran no database test.

### Findings, most severe first

**1. Major. Section 3.2 ("`true` ... from `CheckDocumentAsync` (680, the import: it
writes published rows straight to the tables)"), section 4 ("`ContentBundle.cs` is
not changed"), F5 and B6: the strict check would also run on draft rows and working
copies in the bundle import.**
- **What is wrong:** the import does not check only published rows. It sends every
  collection row, whatever its status, through `CheckDocumentAsync`. It sends every
  working copy (a saved draft of a published item) through it too. If
  `CheckDocumentAsync` passes `publishing: true`, a bundle holding a normal Studio
  draft with `reference.id: ""` or `mediaId: ""` is refused, and the whole import
  rolls back. Section 2.3 says the Studio produces those drafts in normal use. So
  exporting `DigitalHubContent_Studio` and importing it elsewhere would fail on
  content that saved correctly. That contradicts the rationale in 3.2 ("A draft can
  hold an unfinished value"). It also means the dry run in O-ADM02-2 (c) would report
  drafts as problems a build would never see.
- **Evidence:**
  - `api/tools/DigitalHub.ContentImport/ContentBundle.cs:377-388`: every row of each
    collection table goes to `store.CheckDocumentAsync`, with no status filter.
  - `ContentBundle.cs:391-411`: every `working-copies` row goes to
    `store.CheckDocumentAsync`.
  - `ContentStore.cs:679-680`: `CheckDocumentAsync` is a single entry point with no
    status argument.
- **What would satisfy me:**
  - The plan says how the import gets the strict check for published rows only. Two
    ways would do: `CheckDocumentAsync` gains a `publishing` argument that
    `ContentBundle` sets from the row's `Status` (the false value for working copies),
    or `CheckDocumentAsync` reads the status itself.
  - Section 4's file lists match the choice. If `ContentBundle.cs` changes, it moves
    from "Out of scope" to "Files to change".
  - F5 (or a new test) covers both sides: a published row holding `not-a-uuid` is
    refused, and a draft row or working copy holding `id: ""` imports.
  - B6 says which import rows are checked strictly.

**2. Major. Section 3.2 and F4 (`An_upper_case_uuid_reference_publishes`, "guard
against over-strictness"): an upper-case id passes the new format check, and the
website then either stops the build (media) or drops the link without a word
(reference).**
- **What is wrong:** the website's format accepts upper case (`/i`). But the
  website's lookups compare exact strings with the API's lower-case `"D"` ids. The
  API resolves ids with `Guid.TryParse`, which ignores case, so it finds the item,
  reports nothing and publishes.
  - For a `mediaId` in upper case, `missingMediaIds` reports
    `Media <ID> is used by published content but is not in the media list.`, and
    the build stops. That is ADM-02's own defect class ("content the API accepts can
    stop every website build"), and it survives this change.
  - For a reference in upper case, `site.ts` `resolve()` returns `null`. The API
    does not list it in `unresolvedReferences`, because its own key matched. So the
    link disappears and nothing reports it.
  - F4 makes the reference case required behaviour, and W1 has no case for either.
- **Evidence:**
  - `website/src/content/validate.ts:116-123` (`known.has(value)` is case-sensitive)
    and `:212-214` (a missing id is a build problem).
  - `website/src/content/site.ts:48,58,62` (the `Map` lookup and the `references`
    lookup are exact).
  - `api/src/DigitalHub.Api/Content/BuildContentStore.cs:112`
    (`Key = type + ":" + id.ToString("D")`) and `:213-222` (an upper-case id parses,
    so it is not unresolved).
  - `PublishChecks.cs:241` and `MediaUsage.cs:131` use `Guid.TryParse`.
  - `node -e`: the website pattern accepts
    `"01234567-89AB-CDEF-0123-456789ABCDEF"` (true).
- **What would satisfy me:** one of these, chosen in the plan.
  - (a) At publish and import, the API refuses ids that are not lower case, which is
    stricter than the format. By the plan's own argument for redirect case, stricter
    can never break a build. F4 becomes "an upper-case id is refused at publish", and
    W1 or C1 to C3 gain an upper-case `mediaId` case.
  - (b) The upper-case problem is recorded as a separate finding with a destination
    (change id or D-NNN) and shown to the owner. F4 is then kept only as a
    characterisation test, not described as a guard against over-strictness.
  - Section 10 states the residual risk either way.

**3. Minor. Section 10, risk "The import of the old site's content carries non-UUID
ids | A future import is refused": wrong for the old-site importer, which publishes
without the strict check.**
- **What is wrong:** `DigitalHub.ContentImport`'s default import (`ContentWriter`)
  writes rows with `Status = ContentStatus.Published` straight to the tables. It
  checks stored sections with its own `SectionSchemas.Load()` options, which leave
  format unasserted. It never calls `ContentStore.CheckAsync`. So after this change
  it is the one path that still publishes without the website's `uuid` rule. Only
  the bundle import is refused.
- **Evidence:** `ContentWriter.cs:225,284,572,626,651` (`Status = Published`),
  `:86-108` (`ValidateStoredSectionsAsync`), and `SectionPreview.cs:258-277`
  (`new EvaluationOptions { OutputFormat = OutputFormat.List }`, with no
  `RequireFormatValidation`).
- **What would satisfy me:** correct the risk row. Then either put the old-site
  importer's schema check on `SchemaFormats.Asserting()` (one file in scope), or list
  it under "Out of scope" with the reason. The ids it writes are `Guid`s it
  generates, and the website check on the built content still catches anything
  else.

**4. Minor. B4 and section 7 leave out an effect at save: a live page with an
existing slash redirect can no longer be saved.**
- **What is wrong:** the slug-is-a-redirect-source check (`ContentStore.cs:740-742`)
  is in `CheckAsync`, which runs on every save (`:596`, and `:634` through
  `MutateAsync` for section add, update, reorder and visibility). So with
  `Spellings`, B4 also applies at save, not only at publish. A page that is already
  live, with a legacy `/s/` redirect (the ADM-07 part 1 rows that section 7 expects
  in `DigitalHubContent_Studio`), refuses every edit with "That address is the
  source of a redirect." until someone deletes the redirect. That is the right
  outcome, but it is a behaviour change on existing content that staff will hit
  first.
- **What would satisfy me:** B4 says "save and publish". Section 7 lists "live pages
  with a slash redirect cannot be saved until the redirect is deleted". The
  O-ADM02-2 list covers those rows: say that (c) finds them, or add a read-only
  query joining published slugs.

**5. Minor. F2, the `image.mediaId` case: the fixture as written is refused at save
for a different reason.**
- `$defs/media` requires `mediaId`, `alt` and `decorative`
  (`packages/sections/defs.json:9`). F2 says "`mediaId` = `not-a-uuid` (with `alt`)",
  and asserts "Save is 200". Without `decorative`, save returns 400 both at the base
  and after the fix. The test would be red for the wrong reason at commit 1 and
  would never turn green.
- **What would satisfy me:** state the full value, for example
  `{ mediaId: "not-a-uuid", alt: "A", decorative: false }`.

**6. Minor. Sections 3.3, 3.5 and O-ADM02-2 (b) overstate what `check:content`
covers.**
- `checkContent` runs `validateContent` and `renderWebConfig`. A real build also
  stops on `buildRoutes` (`routes.ts:96-101`: route clash, reserved first segment, no
  home page) and on the API-source check for error pages (`prepare.ts:43-48`).
  Leaving them out is right for W1's scoped file, which has no home page. But 3.3
  says "These are the two checks a real build runs on content", 3.5 says "the same
  problem lines a failing build prints", and O-ADM02-2 (b) says "It lists every
  problem a build would stop on". None of those holds.
- **What would satisfy me:** correct the wording. Or give the CLI a full mode (with
  `buildRoutes` and the error-page check) for the exit-gate and O-ADM02-2 use, and
  keep the scoped mode for W1.

**7. Minor. Sections 5.1 and 5.3: the test paths are written loosely.**
- R1 to R7 and W1 write paths such as `/m-x`, `/m-i`, `/m-j` and `/m-elsewhere`.
  The text says "the marker in each test", but it does not say that each path is
  `/<marker>-…`. W1's filter keeps only "redirects whose from path contains it". And
  R7 inserts rows directly, so a fixed path would hit `IX_redirects_from_path` on the
  next run if one cleanup failed.
- **What would satisfy me:** one sentence saying that every path in R1 to R7, F2 to
  F5 and W1 carries the run's marker.

### Checked and found sound

- **Fit.**
  - Section 1 quotes the audit's ADM-02 and ADM-07 text, the refinement plan's G3-1
    exit gate and its success-measure row word for word. I compared them with
    `admin-audit-2026-10-28.md:77-90,149-156` and
    `refinement-plan-2026-10-28.md:225,250`.
  - Fix 4 moves to ADM-01a, and ADM-07 part 3 moves to the ADM-07 change. Both
    destinations are named in the coverage table.
- **The address rule against `web-config.ts`.**
  - `RedirectPaths.Key` is the same as `row.fromPath.replace(/\/+$/, "") || "/"`
    (`web-config.ts:148`) and as the `matchPattern` body (`:127`). My `node -e` run
    gives `/`→`/`, `/x/`→`/x`, `/a/b/`→`/a/b`, `/X/`→`/X`.
  - Two spellings are enough, because `assertPath` and `RedirectPaths.Problem` both
    refuse `//`.
  - A query string cannot occur, because `?` and `#` are refused on both sides.
  - The root: `Spellings("/")` is `["/"]`, and `matchPattern` gives `^/?$`.
  - Case: the build's key and the IIS match (`ignoreCase="false"`) are
    case-sensitive. The `IN` lookup under the case-insensitive collation and the
    unique index make the API stricter, never looser. `OccupiesLivePathAsync`
    compares in memory with ordinal case, which matches the build.
  - Encoded characters: both sides key the raw string the same way. The IIS pattern
    is a literal, so a `%xx` source can never match a decoded live address. That is
    not a takeover and not a duplicate, so the plan needs no rule for it.
- **Every comparison of a redirect source is covered.** `grep FromPath` over
  `api/src` and `api/tools` (outside migrations) finds these:
  - `AdminStore` 137, 140, 601-644, 646-659, 864-883;
  - `ContentStore` 741 and 1055-1074;
  - list, search and ordering, which are not rule checks;
  - `BuildContentStore:371`, which only reads.
  - All the rule checks are in 3.1. The `ToPath` checks at `ContentStore:250` and
    `:1055-1060` stay with ADM-07 part 3, for a stated reason. I walked the loop and
    chain cases (`/a→/a/`, `/a/→/a`, `/p→/q` then `/q/→/p/`, and `/c→/p/`) through
    the planned `ResolveDestinationAsync`, and all of them come out right.
- **Strict at publish, lenient at save.**
  - `PublishAsync` (311) is the only path that sets `Status = Published` in the API
    (`grep`). It serves every collection, and sections are published with their
    item. There is no scheduled publish (no `IHostedService` or `BackgroundService`
    in `api/src` apart from the identity seeder).
  - Unpublish (367) and restore (450) stay lenient, so an item that already holds a
    bad id can still be unpublished or restored into a working copy. That is the
    escape route for existing rows.
  - Error pages hold only rich text (`AdminStore.cs:549-598`).
  - The exceptions are findings 1 and 3.
- **The `uuid` registry.**
  - `EvaluationOptions.FormatRegistry` exists in 8.0.5. Its doc says it is local and
    falls back to the global registry, so setting it changes no global state. A
    future format would fall back to the library's own rule, and F1 (b), which
    requires every `format` value in `packages/` to be `"uuid"`, catches that.
  - My re-run of the probe confirms that `\z` refuses a trailing `\n` where `$` and
    `ECMAScript` accept it, and that a full-width digit and `İ` are refused.
  - JavaScript's non-unicode `/i` maps only `a-f` to `A-F`, so explicit ranges
    without `IgnoreCase` give the same answers. My `node -e` verdicts match F1's
    table on all nine cases.
  - Only one `pattern` exists (`blog-posts` dates). It has the same `$` trap, but
    `ContentDocuments.cs:482` requires `Length == 10`, so it cannot leak.
- **W1 and the CI change.**
  - Every `ApiFactory` class is in `[Collection("SqlServer")]`, and the collection
    has `DisableParallelization = true` (`ApiFactory.cs:13`). Marker scoping
    therefore isolates W1 from other tests' rows.
  - `validateContent` collects every problem rather than stopping at the first.
    `renderWebConfig` stops at the first, but it sees only the marker's redirects.
  - `websiteRoot` is resolved from the working directory, which is `website/`, and
    tsx resolves `@digitalhub/blocks` through `tsconfig` `paths`, as
    `prepare-content.ts` already does.
  - The bin path `dist/cli.mjs` matches `package-lock.json:3252`.
  - The new `ci.yml` steps copy job `website`'s setup and use `@v4` like the rest of
    the file. No other workflow, golden copy (`.github/security/` covers only
    `security.yml`) or test that reads `ci.yml` is affected: the website tests check
    only the `website-browser` job and the `build` script.
  - W1 is a test in the existing G-2 job, not a new gate, so no `*_BLOCKING_FROM`
    date applies. W2 is its canary.
  - No rule I found requires owner sign-off for adding steps to `ci.yml`.
- **Red-first.**
  - The baseline file has 173 names, and it includes
    `RedirectPathRuleTests.The_api_rule_is_the_website_builds_rule`. That supports a
    DB-free fact passing in a class with the fixture, so F1 and W2 can run here.
  - I walked each red against the code: R1 to R7 all reach 201, or no error, at the
    base; F2 and F5 publish; and the architect's probe gives F1 (c) 0 errors for
    `not-a-uuid`.
  - The 19 CI reds add up: 11 + 7 + 1. 18 of them need SQL Server, as the plan says,
    and only F1 can be seen locally.
  - The "no" branch of O-ADM02-1 goes to BLOCKED ON OWNER, with no discretion for
    any role.
  - K1 cannot be in the red commit (it names `RedirectPaths.Key`) and is a drift
    guard, which is acceptable.
  - The commands are Release, and the filters are exact.
- **Scope.**
  - The open pull requests are #52 (`studio/e2e/rich-text.spec.ts`,
    `studio/src/content/RichTextEditor.tsx`, `studio/test/richText.test.tsx`,
    `studio/test/support/pasteFilter.ts`, `docs/changes/ADM-03/*`) and #44
    (`.github/security/*`, `.github/workflows/security.yml`, `docs/changes/GAP-07/*`).
    The plan's file list overlaps neither, and it touches no Studio file.
  - The existing paths the plan names all exist on the base, and the new ones are
    intended.
  - I accept the B-8 reason for one pull request: the audit's own Fix 3 crosses API,
    website and CI.
- **Owner decisions and behaviour changes.** O-ADM02-1 and O-ADM02-2 are PENDING
  and are not assumed from ADM-06b's answer. B1 to B5 bring the code back in line
  with design 4.4, 4.5 and 8.3. B6 is the audit's fix. All of them are shown to the
  owner before gate 1, which follows the ADM-06 precedent. The SQL in O-ADM02-2 is a
  `SELECT` on `dbo.redirects`, and its column names (`from_path`, `to_path`,
  `source`, `created_at`) match the snake-case migration.
  `import --dry-run --database` exists (`BundleCommands.cs:11-13`).
- **Security.** No route or policy changes. W1 starts a child process with fixed
  arguments. The build token is the existing test value. No package is added, the
  lockfile is untouched, there is no migration, and the database names are right.
- **Rollback and risks.** A revert is complete because nothing is stored
  differently, and commits 2 and 3 can be reverted on their own. The risks are
  specific, apart from the risk row in finding 3.
- **Line citations.** All the citations I checked were exact:
  - `AdminStore.cs` 137, 140, 601-644, 646-659, 864-883;
  - `ContentStore.cs` 247-251, 311, 367, 450, 596, 634, 680, 740-742, 1047-1092;
  - `PublishChecks.cs:237-252` and `MediaUsage.cs:126-135`;
  - `FormWalker.tsx` 171, 176-179, 240, 263;
  - `validate.ts:61,71`, `web-config.ts:118,127,148`, and
    `ContentBundle.cs:217-232`.

Verdict: CHANGES NEEDED
