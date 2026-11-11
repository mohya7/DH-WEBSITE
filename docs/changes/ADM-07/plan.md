# ADM-07: plan

Change id: `ADM-07`. Branch: `change/ADM-07`, worktree `/home/user/dh-change-adm07`,
cut from `origin/rebuild/dotnet-platform` at `6262f48` (ADM-02 merged as #54).
Architect, round 2, 11 November 2026. Round 1 (`4b66664`) came back CHANGES
NEEDED (`plan-review.md` Round 1 at `df3af90`: one Major, five Minors). Section 12
answers each one. The owner has answered O-ADM07-1 and O-ADM07-2 (section 9), so
F-2 is now in scope without conditions.

**One change: a redirect must land on a page, and two redirects must never share
an address.** It closes the last part of ADM-07 (targets that do not exist), as
ADM-02's plan handed it over (ADM-02 `plan.md` 3.4 and section 4, "Out of scope").
It also takes the two Minors that ADM-02's gate 2 sent here (F-1, F-2).

## 1. Item

- **Closes:** ADM-07 (Major), part 3. Quoted from
  `docs/quality/admin-audit-2026-10-28.md` (section "Major", lines 149-156):
  > **ADM-07: a manual redirect can take over a live page or loop.**
  > - `/blogs/<live-slug>/` is accepted and emitted ahead of the clean-URL rule, so the
  >   live page returns 301.
  > - `/a → /a/` is accepted: its pattern matches its own target.
  > - A target that does not exist is accepted and built (Phase C 10.7 "every redirect
  >   resolves" is not enforced).
  > - Same root cause as ADM-02. Fix it with path normalisation, plus a target check
  >   that warns in the Studio and reports in the build.
- **Already closed by ADM-02 (#54):** bullets 1 and 2 and "path normalisation"
  (`RedirectPaths.Key` and `Spellings`). This change does not redo them. Its
  end-to-end test covers them again, because the G3 rule asks for one end-to-end
  test per Major, and ADM-02 moved that test here.
- **Remaining scope, as ADM-02 `plan.md` 3.4 and section 4 hand it over:** "the
  target check, its Studio warning (`RedirectsPage.tsx`), its build report, the
  `ToPath` comparisons in `ContentStore.DeleteAsync` (250) and `RetargetAsync`, and
  ADM-07's end-to-end test." I checked this against the audit text above. It is the
  audit's bullet 3 plus its fix ("a target check that warns in the Studio and
  reports in the build"). The `ToPath` comparisons are the same defect: a redirect
  whose target was spelled `/s/` is missed on delete and rename, and is left
  pointing at an address with no page (2.3).
- **Also takes, from ADM-02 gate 2** (`docs/changes/ADM-02/delivery-approval.md`,
  "F-1 and F-2: where they go"; findings in `docs/changes/ADM-02/test-report.md`):
  - **F-1 (Minor):** `CreateRedirectAsync` checks, then inserts, with no
    transaction. Concurrent POSTs of `/x` and `/x/` can both return 201. Gate 2:
    "make the check and the insert one unit (a serializable transaction or
    `sp_getapplock` on the address key). Prove it with a concurrency test: N
    parallel creates of one address give exactly one 201."
  - **F-2 (Minor):** `OccupiesLivePathAsync` counts only Published vacancies, while
    the build also publishes Ended ones at `/careers/<slug>`. Gate 2: "Whether a
    redirect from a closed role's page is wanted is a behaviour question. The ADM-07
    plan must ask the owner, not assume an answer." The owner answered O-ADM07-2:
    "Yes, refuse it" (section 9).
- **Track:** G3, batch G3-1, slot 2. The refinement plan's batch row
  (`refinement-plan-2026-10-28.md`, Track G3) names "ADM-02 and ADM-07 redirect and
  schema checks". Its exit gate: "A clean website build from
  `DigitalHubContent_Studio` with no patched content; each blocker reproduced before
  its fix and passing after it." The G3 track's "Done when": "All six blockers fixed
  by 16 November, the Majors by 11 December, the Minors by 18 December".
- **Requirement fed:** FR-S-11 in the audit's table: "Partly | Can break the build,
  take over a page, or loop (ADM-02, ADM-07)". Also business analysis line 530 (the
  build "checks every redirect lands on a live page") and Phase C 10.7 ("Every
  redirect in the table resolves to a page returning 200").

### Required reading, and what is missing

| File | State |
| --- | --- |
| `CLAUDE.md`, `AGENTS.md` | Read. Identical (`diff AGENTS.md CLAUDE.md`, exit 0) |
| `docs/changes/README.md` | Read |
| `ENGINEERING_STANDARDS.md` | **Missing** in the worktree and on `/mnt/project-files`. Not guessed. Rule ids (P-4, P-6, P-7, P-8, B-6, B-7, B-8) are used only as `docs/changes/README.md` and the ADM-02 records use them |
| `docs/PROJECT_PROFILE.md` | **Missing.** Not guessed |
| `docs/quality/refinement-plan-2026-10-28.md`, `docs/quality/admin-audit-2026-10-28.md` | Not in the worktree (`docs/quality/` does not exist). Read from `/mnt/project-files/docs/quality/` |
| `docs/adr/0001-split-public-forms-api.md` | Not needed (G3), and `docs/adr/` is not in the worktree |
| `docs/deferred-items.md` | **Missing.** Only matters if a D-NNN entry is needed (section 9) |
| `docs/changes/ADM-02/*` | Read: `plan.md` (2.2, 3.1, 3.4, 4, 5, 9), `test-report.md`, `delivery-approval.md` |
| `docs/phase-b-studio.md`, `docs/phase-c-website.md`, `docs/business-analysis.md` | Read for the redirect rules: Phase B lines 125, 144, 146, 158, 252; Phase C 8.1, 10.7; BA 311-312, 530 |

## 2. Current state

### 2.1 The base

```
$ git log --oneline -3
6262f48 ADM-02: Keep API-accepted content passing the website's checks (#54)
b9c5f6f ADM-03: Keep images and typed text in rich-text fields (#52)
6e58af2 ADM-06b-flake: Stop the paging test's toast outliving the test file (#53)
$ git status
On branch change/ADM-07
nothing to commit, working tree clean
```

### 2.2 A target that does not exist is accepted and built

**API.** `AdminStore.CreateRedirectAsync` (`api/src/DigitalHub.Api/Content/AdminStore.cs:129-174`)
checks the from path's characters, self-redirect (138), duplicate address (141-143),
live from path (145), and loop and chain (148-150). Nothing looks at whether a page
answers at the target. The 201 body (166-173) and the list rows
(`ListRedirectsAsync`, 101-127) hold `id, fromPath, toPath, statusCode, source,
createdAt` only.

**Why the API keeps creating such a redirect** (round 2, review finding 6):

- **The audit has decided it.** Its fix is "a target check that **warns** in the
  Studio and reports in the build", not one that refuses.
- **The design requires it.** Phase B 4.5 ("Chains collapse") and 8.3 ("The same
  chain and loop rules as 4.5") accept a redirect whose target is another
  redirect's source, and collapse it. A "target must be a page" rule would refuse
  exactly that case before it could collapse.
- **The existing tests follow from that.** `AdminApiTests.Redirect_refuses_loops_collapses_chains_and_blocks_live_paths`
  (`AdminApiTests.cs:232-285`) expects 201 for `/old-a-<s> → /old-b-<s>` and for
  the chain `/old-c-<s> → /old-a-<s>`, and neither target is a page. They stay
  unchanged because the behaviour they pin stays, not to avoid an owner decision.

**Website.** `renderWebConfig` (`website/src/iis/web-config.ts:142-160`) checks only
the characters and the duplicate key. `scripts/check-output.ts` compares
`out/web.config` with `renderWebConfig(content.redirects, ...)` (372-375) and checks
nothing about targets. `grep -rn -i redirect website/src website/scripts` finds no
target check. Reproduced with a copy of `web-config.ts` in the scratchpad (the only
edits: the two imports point at local copies), Node 22.23.4:

```
$ node repro.mts
renderWebConfig accepted a redirect to /no-such-page:
        <rule name="Redirect /old-offer" stopProcessing="true">
          <action type="Redirect" url="/no-such-page" redirectType="Permanent" appendQueryString="false" />
```

**Studio.** `studio/src/pages/RedirectsPage.tsx` shows From, To and Source (101-112).
On create it shows `message.success("Redirect created.")` (84) whatever the target.
On a refusal it shows `problem.title` in a paragraph on the page behind the open
modal (76-80). Readable messages are ADM-14, not this change.

**How targets go missing later, with no create at all:**

- `ContentStore.UnpublishAsync` (`ContentStore.cs:354-388`) leaves every redirect to
  the item in place. Its page is gone at the next build. This is design behaviour
  (Phase B 159), so this change does not alter it. The Studio flags it instead
  (3.1).
- The `ToPath` comparisons in 2.3.

### 2.3 The `ToPath` comparisons that ADM-02 left alone

`ContentStore.cs` at `6262f48`:

| Where | Line | Comparison | What slips through |
| --- | --- | --- | --- |
| `DeleteAsync`, redirects to the deleted item | 250 | `redirect.ToPath == path` | A redirect to `/s/` is not removed. Its target no longer exists. Phase B 125 says delete "removes redirects whose destination is that item's public path" |
| `RetargetAsync`, the query | 1069 | `redirect.ToPath == oldPath \|\| oldSpellings.Contains(redirect.FromPath)` | A redirect to `/old/` is not loaded |
| `RetargetAsync`, the chain filter | 1071 | `redirect.ToPath == oldPath && Key(FromPath) != oldPath` | So it is not retargeted. Phase B 146: "if A points to B and B is renamed to C, A points to C" |

The comment at 1064-1066 says "Targets are compared as stored". After a rename,
`/in → /old/` is matched by the new `/old → /new` rule, so it still works through
two 301s, but it is a chain the design says must collapse. After a delete it points
at an address with no page.

### 2.4 F-1: check, then insert, with no unit around them

`CreateRedirectAsync` runs `AnyAsync(spellings.Contains(FromPath))` (142), then
`OccupiesLivePathAsync` (six queries, 604-648), then `ResolveDestinationAsync` (one
query per hop), then `SaveChangesAsync` (163). There is no transaction, and no
constraint on the address key. `IX_redirects_from_path` (`ContentModelBuilder.cs:104`)
is unique on the stored text only, so `/x` and `/x/` do not collide there. ADM-02
3.6 rejected storing the key on purpose. Two more consequences, by reading:

- Two concurrent POSTs of the **same** spelling both pass the check. The second
  `SaveChangesAsync` then breaks the unique index: a `DbUpdateException`, which
  nothing catches, so 500.
- Two concurrent POSTs `/p → /q` and `/q → /p` both pass the loop check, so the pair
  loops.

Not reproduced here: there is no SQL Server (2.6). ADM-02's tester found it by
reading too. 5.1 makes it red in CI.

Precedent for a transaction with an explicit isolation level:
`ApplicationIntake.IncrementAsync` (`ApplicationIntake.cs:224-250`,
`BeginTransactionAsync(IsolationLevel.Serializable)` with a single retry). No code
uses `sp_getapplock` today. Program.cs:60 is a plain `UseSqlServer`, with no retrying
execution strategy, so a user transaction needs no `CreateExecutionStrategy`
wrapper. CI job `api` runs the tests as the restricted login `dh_content_app`
(`ci.yml` job `api` env, `User ID=dh_content_app`), which has `db_datareader` and
`db_datawriter` only (`docs/security-deployment.md:13-19`). `sp_getapplock` needs
only membership of `public`, so CI proves it works under that login.

### 2.5 F-2: ended vacancies

- `OccupiesLivePathAsync`, `AdminStore.cs:643-647`: `db.Vacancies.Where(item => item.Status == published)`.
- `BuildContentStore.cs:176`: vacancies are built when `Published || Ended`.
- `website/src/components/VacancyPage.tsx:7-17` renders an ended vacancy with "This
  position is no longer open" and no apply form.
- `website/src/content/site.ts:37` leaves ended vacancies out of listings.
  `website/src/seo/jsonld.ts:185` gives them no JobPosting.
- `ContentStore.UnpublishAsync` refuses anything not Published (362), so an ended
  vacancy cannot be unpublished. `DeleteAsync` refuses only Published (243), so an
  ended vacancy **can** be deleted, and its delete removes redirects to it.
- So today `POST /api/v1/redirects {fromPath:"/careers/<ended>"}` is 201. The
  redirect rule runs before the clean-URL rule, so the ended page answers 301.

### 2.6 Tests and harness

- `api/tests/DigitalHub.Api.Tests/RedirectAddressTests.cs` (ADM-02) and its helper
  `Adm02Run` (`ApiAcceptedContentTests.cs:216-360`): login, `CreateRedirectAsync`,
  `CreateItemAsync`, `PublishedAsync`, `PublishAsync`, `SendAsync`, `Code`, and a
  `finally` cleanup through `DisposeAsync`.
- `CareersTests.PublishedVacancyAsync` and `EndedVacancyAsync` (604-648) show how a
  vacancy is published and ended (`POST /api/v1/vacancies/{id}/end` with
  `{ version }`).
- `AbortedRequestTests.cs:149-152` subclasses `ApiFactory` and uses
  `ConfigureTestServices`. EF Core is 10.0.12, so `services.ConfigureDbContext<ContentDbContext>(o => o.AddInterceptors(...))`
  is available to a test factory.
- `RedirectPathRuleTests.WebConfigSource` and ADM-02's K1 (`RedirectAddressRuleTests.cs`)
  read website sources from a DB-free test. That is the pattern for K2 (5.1).
- `studio/test/listPaging.test.tsx` mocks `request` with `api.handler` and renders
  `RedirectsPage` (76, 319-366). That is the pattern for the Studio unit tests.
- `studio/e2e/paging.spec.ts` and `rich-text.spec.ts` seed through the API with an
  admin token and clean up in `finally`. `openArea` and `signIn` are in
  `studio/e2e/helpers.ts`.
- `website/test/output.test.ts` imports functions from `../scripts/check-output` and
  builds a temporary `out/` with `tempDir`. `check-output.ts` runs `main()` only when
  it is the entry script (last lines), so importing it is safe.
- CI job `studio` (`ci.yml:194-286`) runs "Unit tests" (`npm test`) **before** "End-to-end
  suite", with no `if: always()`. A red unit test therefore hides the end-to-end
  result. 5.2 orders the commits for that.

**What runs in this container.**

- .NET from `dn.sh`. `dotnet build DigitalHub.slnx -c Release` at `6262f48`:
  `13 Warning(s)`, `0 Error(s)`. `git status --short` stays empty (`bin/` and `obj/`
  are ignored).
- No SQL Server: `(echo > /dev/tcp/127.0.0.1/4299)` gives `Connection refused`. The
  full API suite pointed at that port (`ApiFactory` rewrites the catalog to
  `DigitalHubContent_Test`):
  ```
  Failed!  - Failed:   345, Passed:   175, Skipped:     0, Total:   520, Duration: 15 s - DigitalHub.Api.Tests.dll (net10.0)
  ```
  The 175 passing names are in
  `/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm07/base-passed.txt`.
  Compared with ADM-02's tester run at `a34947a` (176), the one missing name is
  `ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file` (W2). It fails
  with "Run npm ci in website/ first." because `website/node_modules` is not
  installed in this worktree, and I did not install it (architect rule). After the
  developer's `npm ci`, the baseline is 176.
- Node 22.23.4. `website/node_modules` and `studio/node_modules` are missing, so the
  website and Studio suites were NOT RUN here.

## 3. Design

### 3.1 The target check: one rule, in the API and in the build

**What counts as a page.** A target "resolves" when its address
(`RedirectPaths.Key(toPath)`, trailing slash removed) is one the build writes as a
page:

- the public path (`ContentPaths.PublicPath`) of every item the build emits
  (`BuildContentStore.LoadAsync`): published pages (not the two error pages, which
  the build serves at `/404` and `/500`), services, partners, case studies, blog
  posts, and vacancies that are published **or ended**;
- the website's own fixed pages. Today that is one, `/privacy-careers`
  (`check-output.ts:75`, `const staticFiles = ["privacy-careers.html"]`).

Comparison is ordinal. Website routes are lower-case clean paths
(`routes.ts`, `cleanPath`), so `/About`, `/about.html`, `/media/x.webp`, `/404` and
`/500` do not count. Media and error pages are not "a page returning 200" (Phase C
10.7).

**API.** A new static class `RedirectTargets` in
`api/src/DigitalHub.Api/Content/RedirectTargets.cs`:

- `StaticPaths`: `["/privacy-careers"]`, with a summary that names
  `check-output.ts`'s `staticFiles`. K2 (5.1) locks the two together.
- `LivePathsAsync(ContentDbContext db, CancellationToken ct)`: a
  `HashSet<string>(StringComparer.Ordinal)` of the addresses above. One query per
  collection, slugs only. The error-page slugs come from `BuildContentStore`'s
  `ErrorSlugs` (made `internal`), so there is one list.
- `Resolves(string toPath, IReadOnlySet<string> live) => live.Contains(RedirectPaths.Key(toPath))`.

Used in two places in `AdminStore`:

- `CreateRedirectAsync`: after the chain collapses, the 201 body gains
  `targetLive` (bool), computed on the **stored** `ToPath`. The redirect is still
  created. That is the audit's "warns", and it keeps the existing tests in 2.2.
- `ListRedirectsAsync`: each row gains `targetLive`. The set is built once per
  request. This is what flags redirects left without a page by an unpublish or a
  deletion, which no create-time check can see.

**Studio** (`RedirectsPage.tsx`):

- `RedirectRow` gains `targetLive?: boolean`.
- The To column shows the path and, when `targetLive === false`, a "No page" marker.
  The marker uses the warning colour on its text and icon only, as Phase B 466 sets
  for the slug-redirect warning. Its `title` reads: "No published page answers at
  this address. Visitors who follow this redirect see the 404 page."
- After a create whose body has `targetLive: false`, it shows
  `message.warning("Redirect created, but no published page answers at <toPath>. Visitors who follow it see the 404 page.")`
  instead of "Redirect created.". `<toPath>` is the stored, collapsed target.
- A row without the field (an older API) shows no marker.

**Build report** (`website/scripts/check-output.ts`):

- A new exported function, `redirectTargetReport(outDir, redirects): string[]`, gives
  one line per redirect whose target's address has no page file in `out/`:
  `Redirect <from> -> <to>: no page in the build answers at <to>.`
  - The address is the key (`toPath.replace(/\/+$/, "") || "/"`, the
    `web-config.ts` expression). The file is `htmlFileFor(key)`.
  - **The file is looked up in the walked file list, ordinally** (round 2, review
    finding 5). The function builds the list as `checkOutput` does
    (`walk(outDir)` made relative with `/` separators, into a `Set`,
    `check-output.ts:105-106`) and tests `set.has(file)`. It never calls
    `fs.existsSync`, which finds `About.html` for `/About` on the
    case-insensitive file systems of Windows and macOS. So W3 gives the same
    answer on the owner's Windows machine as on `ubuntu-24.04`.
  - `404.html` and `500.html` (`errorFiles`) never count.
  - The rule is the API's, applied to what the build actually wrote.
- `main()` prints either `Redirect targets: all <n> resolve to a page.` or
  `Redirect targets: <k> of <n> point at no page (reported, not a failure):`
  followed by the lines.
- **It does not add to `report.problems`, so the build does not fail.** The audit
  says "reports in the build". A failing build would let one unpublish stop every
  website build, which is the ADM-02 defect class again. It is behaviour change B3,
  for the owner to see.

### 3.2 The `ToPath` comparisons

- `DeleteAsync` (250): `RedirectPaths.Spellings(path).Contains(redirect.ToPath)`. It
  translates to SQL `IN`, as ADM-02's `FromPath` comparisons do.
- `RetargetAsync` (1069, 1071): `oldSpellings.Contains(redirect.ToPath)` in the query
  and in the chain filter. The comment at 1064-1066 changes from "Targets are
  compared as stored" to "by address" too.
- The retargeted `ToPath` is written as `newPath`, which has no trailing slash
  (`ContentPaths`). The existing self-check at 1074 (`Key(FromPath) == Key(ToPath)`,
  then delete) still applies.

### 3.3 F-1: one unit around check and insert

In `CreateRedirectAsync`, after the input checks (130-139) and before the duplicate
check:

1. `await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);`
   (read committed, the default).
2. Take an application lock owned by the transaction, through an output parameter:
   `EXEC @result = sp_getapplock @Resource = N'digitalhub:redirects', @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 5000;`
3. If `@result < 0` (timeout, deadlock or error), return
   `503 redirect_busy`, "Another redirect is being saved. Try again." The
   transaction rolls back when disposed. T10 (5.1) proves this branch, the 503
   rather than a 500, that nothing is inserted, and the resource name.
4. The duplicate, live-path and loop checks, the insert, the audit row and
   `SaveChangesAsync` run as now. Then `tx.CommitAsync`. Every early return
   disposes the transaction, which rolls back and releases the lock.

**One lock for all creates, not one per address.** It also closes the concurrent
loop (`/p → /q` with `/q → /p`, 2.4), whose two rows have different keys. Manual
redirects are created by hand, a few at a time, so serialising them costs nothing
anyone can see. The lock name is fixed, so there is no resource-length or case
question.

**Not locked, on purpose:**

- `DeleteRedirectAsync` cannot create a duplicate or a loop.
- `ContentStore.RetargetAsync` writes a redirect from the old address while its
  page is still live to every other reader until the publish commits. A concurrent
  manual create of that address (either spelling) is refused by
  `OccupiesLivePathAsync` before the commit and by the duplicate check after it.
  What remains is a rename racing a manual create that closes a loop through
  different keys. That needs a rename and a hand-made reverse redirect in the same
  instant, and a loop is still visible in the Studio list. It is in section 10, not
  fixed.
- The bundle import (`ContentBundle.cs`) runs offline in its own transaction and
  re-checks every row (`CheckRedirectAsync`).

### 3.4 F-2: ended vacancies (O-ADM07-2: "Yes, refuse it")

- `OccupiesLivePathAsync`'s vacancy query becomes
  `item.Status == published || item.Status == ContentStatus.Ended`, the same
  predicate as `BuildContentStore.cs:176`. That is one line.
- The import check (`CheckRedirectAsync`) calls the same function, so a bundle row
  from an ended vacancy's address is refused too.
- Staff who want a closed role's address to go elsewhere delete the ended vacancy
  first (allowed, 2.5), then add the redirect.
- A target at an ended vacancy counts as a page (3.1), because the build writes it.
- O-ADM02-2's query (b) no longer needs widening: the owner's read-only check found
  no redirects at all in `DigitalHubContent_Studio` (section 7).

### 3.5 Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Refuse a redirect to a target that does not exist (400) | The audit's fix says "warns", so the audit has already decided. Phase B 4.5 and 8.3 accept a redirect to another redirect's source and collapse it, which such a rule would refuse first. It would also block a legitimate order of work (redirect first, publish the page later), and it cannot see targets that go missing after an unpublish. As a consequence, `AdminApiTests.Redirect_refuses_loops_collapses_chains_and_blocks_live_paths` keeps its 201s unchanged (2.2) |
| A two-step create: refuse with 409 unless the client sends `confirm: true` | A new request field and a second round trip for a warning. The marker in the list is persistent anyway |
| Fail the website build on a missing target | One unpublish would stop every build, which is the ADM-02 defect class. The audit says "reports in the build". Shown to the owner as B3, who can ask for a failure instead |
| Put the target report in `check-content.ts` | It deliberately runs no route table (its header). `check-output.ts` checks the files the build actually wrote, which is what Phase C 10.7 asks |
| Count `.html` spellings (`/about.html`) as pages | IIS would serve the file, but the website links only clean addresses, and the API would need a second rule. Warning on it costs nothing, and the fix is to type the clean address |
| Case-insensitive target comparison | Website routes are lower-case only (`cleanPath`). A warning on `/About` is the right nudge, and it errs toward warning |
| Reuse `OccupiesLivePathAsync` for targets | It counts the error pages' `/error-404` and `/error-500` as live, which the build does not serve. Changing that for targets would change from-path behaviour as a side effect |
| F-1 with a serializable transaction | Two creators both take range-shared locks and then both try to insert, so one becomes a deadlock victim (1205), which needs its own retry and mapping. It also does not cover the loop pair, which has two keys |
| F-1 with a per-address `sp_getapplock` | Does not serialise the loop check across keys, and needs a hashed resource name (the 300-character limit against the lock's 255). One fixed name is simpler |
| F-1 with a stored key column and a unique index | A schema migration (prefer none). It would fail on any existing `/x` and `/x/` pair until O-ADM02-2's clean-up is done. ADM-02 3.6 rejected storing the key |
| F-1 by catching the unique-index violation | It only covers identical spellings, not `/x` and `/x/` |
| Warn on unpublish ("2 redirects point here") | Useful, but it is a change to the publish flow and its messages (ADM-14, ADM-20). The list marker already shows it |

## 4. Scope

### Files to create

| File | What |
| --- | --- |
| `api/src/DigitalHub.Api/Content/RedirectTargets.cs` | `StaticPaths`, `LivePathsAsync`, `Resolves` (3.1) |
| `api/tests/DigitalHub.Api.Tests/RedirectTargetTests.cs` | T1 to T6 and T9 (database) |
| `api/tests/DigitalHub.Api.Tests/RedirectConcurrencyTests.cs` | T7, T8 and T10 (database), with its own `ApiFactory` subclass and command interceptor (5.1) |
| `api/tests/DigitalHub.Api.Tests/RedirectTargetRuleTests.cs` | K2 (DB-free) |
| `website/test/redirect-targets.test.ts` | W1 to W4 |
| `studio/test/redirects.test.tsx` | S1 to S3 |
| `studio/e2e/redirects.spec.ts` | E1, ADM-07's end-to-end test |

### Files to change

| File | What changes |
| --- | --- |
| `api/src/DigitalHub.Api/Content/AdminStore.cs` | `CreateRedirectAsync`: the transaction and lock (3.3) and `targetLive` in the 201 body (3.1). `ListRedirectsAsync`: `targetLive` per row. `OccupiesLivePathAsync`: the vacancy predicate (3.4). Nothing else |
| `api/src/DigitalHub.Api/Content/ContentStore.cs` | `DeleteAsync` line 250 and `RetargetAsync` lines 1064-1071: `ToPath` by spellings (3.2). Nothing else |
| `api/src/DigitalHub.Api/Content/BuildContentStore.cs` | `ErrorSlugs` from `private` to `internal`. No behaviour change |
| `studio/src/pages/RedirectsPage.tsx` | The `targetLive` field, the "No page" marker, the create warning (3.1) |
| `website/scripts/check-output.ts` | `redirectTargetReport` (exported) and its lines in `main()` (3.1). The checks already there do not change |

No lockfile, `package.json`, `*.csproj` or workflow changes.

### Out of scope (left alone on purpose)

- **Readable refusal messages, and the error shown behind the open modal**
  (`RedirectsPage.tsx:76-80`): ADM-14 and ADM-20.
- **A warning at unpublish** about redirects that point at the item: 3.5. The list
  marker covers it.
- **Editing a redirect's target in the Studio.** Phase B 8.3 is "list, add, remove".
  Staff delete and re-add.
- **A filter for "No page" rows** in the list. Search works on paths. Not asked by
  the audit.
- **The error pages' `/error-404` and `/error-500` in `OccupiesLivePathAsync`.** It
  calls them live, but the build serves them at `/404` and `/500`. Harmless (it only
  refuses more). Noted in 10, not changed.
- **The rename and manual-create loop race** (3.3): section 10.
- **IIS-level proof that each redirect answers 200**: Phase D (a deploy target).
  The build report is the check this change adds.
- **The G3-1 exit-gate build:** the coordinator's. O-ADM02-2's read-only check has
  already run (section 7). After this change, the Studio list itself shows which
  redirects point at no page.
- **ADM-01a** (build status in the Studio). The build report is printed in the build
  log. ADM-01a decides how a build run's output reaches the Studio.
- **No migration** (section 7).

## 5. Test plan

### 5.1 Failing tests, written first

**Marker rule (as ADM-02).** Each test makes
`m = "adm07-" + Guid.NewGuid().ToString("N")[..8]`. Every path, slug and title it
creates starts with `m`. In the tables, `/m-x` means `/<m>-x`. Database tests are
`[Collection("SqlServer")]` with `IClassFixture<ApiFactory>` (T7, T8 and T10 use
their own factory). They log in as the admin and delete what they create in `finally`:
redirects through `DELETE /api/v1/redirects/{id}`, items unpublished (when
published) and then deleted, as `Adm02Run` does. Reusing `Adm02Run` is allowed. It
is `internal` to the test project, and no change to it is planned.

**`RedirectTargetTests.cs` (database).**

| # | Test | Asserts | Red at base | Green |
| --- | --- | --- | --- | --- |
| T1 | `A_redirect_to_an_address_with_no_page_is_created_and_flagged` | POST `/m-old → /m-nowhere`: 201 and `targetLive` is `false`. `GET /api/v1/redirects?search=<m>`: the row has `targetLive` `false` | 201, but the body and the row have no `targetLive`. The test fails on a missing property, with the body in the message | As asserted |
| T2 | `A_redirect_to_a_live_page_is_not_flagged` [Theory: `""`, `"/"`] | Publish page `<m>-live`. POST `/m-in → /<m>-live` + suffix: 201, `targetLive` `true`, in the body and the list | No property | As asserted |
| T3 | `Targets_count_as_pages_exactly_where_the_build_writes_one` [Theory over target and expected value] | `/careers/<m>-ended` (a vacancy published, then ended, as `CareersTests.EndedVacancyAsync` does): `true`. `/privacy-careers`: `true`. `/<m>-draft` (a draft page): `false`. `/<m>-live.html`: `false`. `/<M>-LIVE` (upper case of a live page): `false`. `/404`: `false` | No property | As asserted |
| T4 | `Unpublishing_a_page_flags_the_redirects_that_point_at_it` | Publish `<m>-p`. POST `/m-in → /<m>-p` (`targetLive` `true`). Unpublish `<m>-p`. The list row now has `targetLive` `false` | No property | As asserted |
| T5 | `Deleting_an_item_removes_redirects_to_its_address_with_a_trailing_slash` | Publish `<m>-p`. POST `/m-in → /<m>-p/` (201). Unpublish, then delete `<m>-p` (204). `GET /api/v1/redirects?search=<m>-in`: total 0. The audit log has a `delete_redirect` row for it | Total 1: the redirect survives, pointing at nothing | As asserted |
| T6 | `A_rename_retargets_redirects_to_the_old_address_with_a_trailing_slash` | Publish `<m>-p`. POST `/m-in → /<m>-p/`. Rename to `<m>-q` and publish. The `/m-in` row's `toPath` is `/<m>-q`. Exactly one row has key `/<m>-p`, and it points at `/<m>-q` | `/m-in`'s `toPath` stays `/<m>-p/`, a chain through `/<m>-p → /<m>-q` | As asserted |
| T9 | `A_redirect_cannot_take_over_an_ended_vacancy` [Theory: `""`, `"/"`] | End vacancy `<m>-v`. POST `/careers/<m>-v` + suffix `→ /careers`: `400 redirect_live_path`. And `AdminStore.CheckRedirectAsync` on a row inserted through `ContentDbContext` from `/careers/<m>-v` returns a `fromPath` error | 201, and no import error | As asserted |

T1 to T4 are red on a missing field. That is an honest red: the API today gives
staff nothing to warn with. The assertion message must print the response body, so
the CI log shows the absence.

**`RedirectConcurrencyTests.cs` (database).**

The class has its own factory, `GatedApiFactory : ApiFactory`. Its
`ConfigureWebHost` calls `base.ConfigureWebHost` and then
`ConfigureTestServices(s => s.ConfigureDbContext<ContentDbContext>(o => o.AddInterceptors(Gate)))`.
`Gate` is a `DbCommandInterceptor`.

**The gate's rules** (round 2, review finding 2):

- **Match.** While it is armed with a marker, the gate holds every reader command
  whose text reads the redirects table **and** has a parameter whose value
  **contains** the marker.
  - "Contains", not "starts with": the paths are `/<m>…`, so every value starts
    with `/`.
  - EF Core 10 may send `spellings.Contains(redirect.FromPath)` as one scalar
    parameter per element, or as a single JSON-array parameter
    (`["/adm07-…","/adm07-…/"]`). "Contains" matches both.
  - The developer confirms the exact command text and parameter shape from the EF
    log before relying on the match. The test fails (it does not skip) if the
    gate saw no command.
- **Release.** The gate holds the matched commands until two have arrived, or for
  at most **2 seconds**. Then it releases them all and disarms.
- **Warm-up before arming.** Before the gate is armed, the test logs in and does one
  create and one delete of a throwaway redirect through the same factory. That
  compiles the login, the six `OccupiesLivePathAsync` queries, the resolve query
  and the insert. Without it, on a cold factory the two requests can arrive more
  than 2 s apart. The first would then insert alone, the second would get 409, and
  T7 would be green at the red commit.
- **The cap must stay under the lock timeout.** At green, the second request waits
  in `sp_getapplock` while the gate holds the first. So the gate's cap (2 s) must
  stay well under the lock timeout (5 s, 3.3), or T7 turns into a 503. A comment
  in the test says so, next to both numbers.

| # | Test | Asserts | Red at base | Green |
| --- | --- | --- | --- | --- |
| T7 | `Two_creates_of_one_address_at_once_give_one_redirect` [Theory: (`/m`, `/m/`), (`/m/`, `/m`), (`/m`, `/m`)] | Warm up, then arm the gate. Send both POSTs (`toPath` `/`) at once (`Task.WhenAll`). Exactly one is 201. The other is `409 redirect_exists`. Neither is 5xx. One row has key `/m` | The gate makes both duplicate checks run before either insert. Mixed spellings: two 201s. The same spelling: one 201 and one 500 (`DbUpdateException` on `IX_redirects_from_path`) | The second request waits in `sp_getapplock`, so the gate releases the first alone after 2 s. The second then sees the row: 409 |
| T8 | `Many_creates_of_one_address_at_once_give_one_redirect` | No gate. The same warm-up before round 1 (review finding 3). Five rounds, each with its own marker. Each round sends 8 POSTs at once, alternating `/m-r` and `/m-r/`. Per round: exactly one 201, seven `409 redirect_exists`, no 5xx. The test writes each round's slowest request time to the test output | Likely red (more than one 201, or a 500), but timing-dependent. T7 is the deterministic red | Passes on every run: the lock serialises the creates |
| T10 | `A_create_that_cannot_get_the_lock_in_time_is_refused_as_busy` (round 2, review finding 1) | Open a separate `SqlConnection` with the test connection string (the factory's, rewritten to `DigitalHubContent_Test`). `BEGIN TRAN`, then `EXEC sp_getapplock @Resource = N'digitalhub:redirects', @LockMode = N'Exclusive', @LockOwner = N'Transaction'`, and assert its result is `>= 0`. POST `/m-busy → /`: `503`, code `redirect_busy`. `GET /api/v1/redirects?search=<m>-busy`: total 0. Roll back the holder in `finally`. The same POST is then 201 | 201 at once: no lock is taken. The test fails at the 503 assertion | As asserted, after about 5 s (the lock timeout) |

T8 is the gate-2 wording ("N parallel creates of one address give exactly one
201"). T7 is what makes the red certain. If T8 happens to pass at the red commit,
that is reported as it is, not hidden. T7 must still be red.

T10 proves the `@result < 0` branch: the 503 rather than a 500, the rollback (no
row), and the resource name, because the holder uses the documented name and the
create must wait on it. The holder's connection takes the lock in the test
catalog only, and it is released in `finally` by rollback and by closing the
connection.

**`RedirectTargetRuleTests.cs` (DB-free).**

| # | Test | Asserts |
| --- | --- | --- |
| K2 | `The_api_counts_the_website_builds_fixed_pages` | Reads `website/scripts/check-output.ts` (found as `RedirectPathRuleTests.WebConfigSource` finds `web-config.ts`). Its `const staticFiles = [...]` mapped to `"/" + name` without `.html` equals `RedirectTargets.StaticPaths`. Its `const errorFiles` is exactly `["404.html", "500.html"]`, and `BuildContentStore.ErrorSlugs` has exactly the keys `404` and `500`. The file contains `export function redirectTargetReport` |

K2 names `RedirectTargets`, which does not exist at the base. Like ADM-02's K1, it is
a drift guard, not the regression test, and it lands with the fix (5.2).

**`website/test/redirect-targets.test.ts` (vitest).** It imports the module as a
namespace (`import * as output from "../scripts/check-output"`). It reads
`redirectTargetReport` through a cast and asserts first that it is a function. So
the file typechecks at the base, and its red is an assertion, not a compile error.

| # | Test | Asserts |
| --- | --- | --- |
| W1 | `reports a redirect whose target has no page` | `out/` with `index.html` and `about.html`. Redirects `/a → /about` and `/b → /missing` give exactly `["Redirect /b -> /missing: no page in the build answers at /missing."]` |
| W2 | `a trailing slash, the home page and the fixed pages resolve` | `/c → /about/`, `/d → /`, `/e → /privacy-careers` (with `privacy-careers.html`) give `[]` |
| W3 | `error pages, html spellings, upper case and media do not count` | With `404.html`, `500.html`, `about.html` and `media/x.webp` present: targets `/404`, `/500`, `/about.html`, `/About` and `/media/x.webp` each give one line. `/About` gives its line on every file system, because the lookup is in the walked list, not `fs.existsSync` (3.1) |
| W4 | `no redirects, no lines` | `redirectTargetReport(out, [])` is `[]`. The committed snapshot has 0 redirects (`web.config: 0 redirect(s)` in ADM-02's build), so the CI `website` build prints `Redirect targets: all 0 resolve to a page.` |

All four are red at the base: "check-output.ts exports redirectTargetReport"
fails.

**`studio/test/redirects.test.tsx` (vitest, the `listPaging.test.tsx` mock pattern).**

The toasts are spies, never rendered (round 2, review finding 4). antd's static
`message.*` renders into a React root of its own, which outlives `cleanup()`
(`docs/changes/ADM-06b-flake/plan.md`; the comment at `listPaging.test.tsx:57-62`).
So the file does what `listPaging.test.tsx:63-67` does, for both calls:

- `vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn() }))`, and `vi.mock("antd", …)`
  replaces `message.success` and `message.warning` with them;
- `beforeEach` clears both spies;
- `afterEach` runs `cleanup()` and asserts `document.body.innerHTML` is `""`, as
  `listPaging.test.tsx:165-169` does.

| # | Test | Asserts | Red at base |
| --- | --- | --- | --- |
| S1 | `warns when a created redirect points at no page` | POST answers 201 with `toPath: "/nowhere"`, `targetLive: false`. `message.warning` was called once, with "Redirect created, but no published page answers at /nowhere. Visitors who follow it see the 404 page." `message.success` was not called | `message.success("Redirect created.")` is called, and `message.warning` is not |
| S2 | `marks rows whose target has no page` | A list with one row `targetLive: false` and one `true`. "No page" appears once, in the first row (this marker is rendered inside `render()`'s root, so it is asserted as text) | No marker |
| S3 | `a redirect to a page is created quietly` | 201 with `targetLive: true`: `message.success` was called once with "Redirect created.", `message.warning` was not called, and there is no marker | Passes (guard) |

**`studio/e2e/redirects.spec.ts` (Playwright, `DigitalHubContent_E2e`).**

| # | Test | Steps and asserts |
| --- | --- | --- |
| E1 | `ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged` | Seed through the API with an admin token: publish page `e2e-adm07-<stamp>`. In the Studio, as admin, open Redirects and use Add redirect: (1) `/<slug>/ → /` shows "A redirect source cannot equal the path of a live page." (ADM-07 part 1). (2) `/<stamp>-a → /<stamp>-a/` shows "A redirect cannot point at itself." (part 2). (3) `/<stamp>-old → /<stamp>-nowhere` shows the warning toast, and after searching `<stamp>` its row shows "No page" (part 3). (4) `/<stamp>-ok → /<slug>/` shows "Redirect created." and its row has no marker. `finally`: delete the redirects, unpublish and delete the page, through the API |

Red at the base: steps 1 and 2 pass (ADM-02). Step 3 fails at the toast. That is
the planned red.

**Guards that must stay green, unchanged:** `AdminApiTests.Redirect_refuses_loops_collapses_chains_and_blocks_live_paths`,
all of `RedirectAddressTests` (R1 to R7), `RedirectAddressRuleTests` (K1),
`RedirectPathRuleTests`, `ContentPublishTests.Publish_refuses_a_rename_that_would_loop`
and `Slug_cannot_match_a_redirect_source`, `ListPagingTests`, `CareersTests`,
`ContentBundleTests`, `listPaging.test.tsx` (its redirect rows have no `targetLive`,
so they show no marker), and `studio/e2e/paging.spec.ts`.

### 5.2 Commit order (B-6, P-4)

1. `ADM-07: Test that redirects land on a page and never share an address`
   - API: `RedirectTargetTests.cs` (T1 to T6, T9) and `RedirectConcurrencyTests.cs`
     (T7, T8, T10).
   - Website: `redirect-targets.test.ts` (W1 to W4).
   - Studio: `e2e/redirects.spec.ts` (E1).
   - **Not** the Studio unit tests (commit 2). CI job `studio` runs unit tests
     before the end-to-end suite (2.6), so a red unit test would hide E1's red.
   - No change under `api/src`, `studio/src`, `website/src` or `website/scripts`.
2. `ADM-07: Test the Studio's redirect warning`
   - `studio/test/redirects.test.tsx` (S1 to S3). Red locally after `npm ci` (5.3).
     If O-ADM07-1 is Yes, it is pushed only after commit 1's CI run has finished
     jobs `api`, `website` and `studio` (5.4). O-ADM07-1 is "Yes, red tests first"
     (section 9).
3. `ADM-07: Compare redirect targets by address on delete and rename`
   - `ContentStore.cs` (3.2). Makes T5 and T6 green.
4. `ADM-07: Tell staff when a redirect points at no page`
   - `RedirectTargets.cs`, `BuildContentStore.cs` (`internal`), `AdminStore.cs`
     (`targetLive`), `RedirectTargetRuleTests.cs` (K2), `RedirectsPage.tsx`. Makes
     T1 to T4, K2, S1, S2 and E1 green.
5. `ADM-07: Report redirects with no page in the build`
   - `check-output.ts`. Makes W1 to W4 green.
6. `ADM-07: Make a redirect's checks and insert one unit`
   - `AdminStore.CreateRedirectAsync` (3.3). Makes T7, T8 and T10 green.
7. `ADM-07: Treat an ended vacancy's page as live for redirects`
   - `OccupiesLivePathAsync` (3.4). Makes T9 green.

Each fix commit can be reverted on its own.

### 5.3 Local evidence, in this container

Set up (no database is touched; nothing listens on 4299):

```bash
. /tmp/claude-0/-home-user-DH-WEBSITE/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/dn.sh
cd /home/user/dh-change-adm07/api
export CS="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True"
```

Use a fresh `HOME` for each `dotnet test`. Run `npm ci` in `website/` and `studio/`
from the unchanged lockfiles.

**After commit 1 (red):**

```bash
dotnet build DigitalHub.slnx -c Release
cd ../website && npx vitest run test/redirect-targets.test.ts && npm run typecheck
```

- Expected: build 0 errors. W1 to W4 fail at "check-output.ts exports
  redirectTargetReport", quoted as run. Typecheck passes.
- T1 to T10 and E1 need SQL Server. Locally they fail at the connection or the
  login, which is not the red. NOT RUN here; CI jobs `api` and `studio` (5.4).

**After commit 2 (red):**

```bash
cd studio && npx vitest run test/redirects.test.tsx && npx tsc -b
```

- Expected: S1 and S2 fail as in 5.1, quoted as run. S3 passes. `tsc -b` passes.

**After the fix commits (green):**

- `dotnet build DigitalHub.slnx -c Release`: 0 errors, and no more than the 13
  warnings of 2.6.
- K2: `HOME=<fresh> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter "FullyQualifiedName~RedirectTargetRuleTests|FullyQualifiedName~RedirectAddressRuleTests|FullyQualifiedName~RedirectPathRuleTests"`.
  K2 and K1 pass. `RedirectPathRuleTests`' database cases fail at the login, as at
  the base.
- Full API suite without a database:
  `HOME=<fresh> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --logger "trx;LogFileName=<scratch>/adm07-after.trx"`.
  Diff the passed names against
  `/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm07/base-passed.txt`
  (175 at `6262f48`, without `website/node_modules`). With `npm ci` done, expect
  176 + K2 = 177: the 175, plus W2 (now that `node_modules` exists), plus K2. Any
  name that passed and now fails is a regression, reported before anything else.
- `cd website && npm run typecheck && npm test && npm run design:check`, then
  `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build`.
  Expected: all pass, and the build log shows
  `Redirect targets: all 0 resolve to a page.` and `Build output checks passed.`
- `cd studio && npx tsc -b && npm test && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build`: all pass.

### 5.4 CI evidence on the pull request

- **Red, at commit 1** (O-ADM07-1 is "Yes, red tests first"):
  - Job `api`: T1, T2 (2), T3 (6), T4, T5, T6, T7 (3), T9 (2) and T10 fail, and T8
    probably fails. Quote each assertion. T7's messages must show two 201s, or a
    201 and a 500. T10's must show 201 where 503 was expected. Every other test
    passes.
  - Job `website`: "Tests" fails with W1 to W4 and nothing else.
  - Job `studio`: unit tests pass (S1 to S3 are not in commit 1). In the end-to-end
    suite, E1 fails at step 3 and every other test passes.
  - Wait until `api`, `website` and `studio` have finished before pushing again.
    `cancel-in-progress` cancelled part of ADM-02's red run when the branch was
    pushed early (ADM-02 `delivery-approval.md`, round 2).
- **Red, at commit 2:** job `studio`, "Unit tests": S1 and S2 fail. E1 does not run.
  The local red (5.3) is evidence enough on its own.
- **Green, every workflow on the final head:**
  - `ci.yml`: `api` (quote the TRX total: the base's 520 plus the new cases),
    `website`, `studio` (unit and end-to-end), `section-compare`, `website-browser`;
  - `security.yml`; `workflow-lint.yml`.
- **Quote T8's timings** from the green `api` log: each round's slowest request
  (review finding 3). Any `redirect_busy` in T8 at green is a failure to report,
  not to retry away.
- **Quote T10's duration** at green: about 5 s, the lock timeout.
- **Watch:** `studio/e2e/paging.spec.ts` creates 51 redirects to `/`. Each create now
  takes the lock, one after another. They were already sequential in the test, so
  its time should not change. Quote its duration before and after.

### 5.5 Track checklist (G3), from `docs/changes/README.md`

| Item | How it is met |
| --- | --- |
| The finding, its evidence and its fix come from the audit | Section 1 quotes ADM-07. 2.2 reproduces bullet 3 on the website side. The fix is the audit's: "a target check that warns in the Studio and reports in the build" (3.1). F-1 and F-2 come from ADM-02's test report, routed by its gate 2 |
| The regression test is committed and shown failing before the fix | Commits 1 and 2 come before any fix. W1 to W4 and S1, S2 are red locally. T1 to T10 and E1 are red in CI on commit 1, which O-ADM07-1 ("Yes, red tests first") allows to be pushed first |
| The end-to-end suite gets a test for each Major | E1 covers all three ADM-07 bullets |
| A Minor that is not fixed becomes a D-NNN entry | Both are fixed: F-1 (3.3) and F-2 (3.4, as O-ADM07-2 decided). No D-NNN entry is needed |
| G3-1 exit gate: "each blocker reproduced before its fix and passing after it" | ADM-07 is a Major in a Blocker batch. Reproduced in 2.2 and by the CI red (5.4). Passing in 5.3 and 5.4 |
| G3-1 exit gate: "A clean website build from `DigitalHubContent_Studio` with no patched content" | Not met by this change alone (it also needs ADM-05 and the rest of the batch). The owner's read-only check found 0 redirects there and the build content passed `check:content` (section 7), so this change's report should read `all 0 resolve to a page` on that build |

## 6. Security impact

- **Routes and policies:** none added or changed. `GET` and `POST /api/v1/redirects`
  keep `[Authorize(Policy = "studio")]` (`AdminControllers.cs:27-29`).
- **Data exposed:** `targetLive` says whether a published page answers at a path.
  Only Studio users see it, and they can already list all content. The build
  content endpoint is unchanged.
- **Input validation:** unchanged, except that a redirect from an ended vacancy's
  address is now refused (F-2, B6). Nothing refused today is accepted.
- **Availability:**
  - The lock serialises redirect creates. A create waits at most 5 s for the lock
    and then gets `503 redirect_busy` (B5).
  - The lock is owned by the transaction, so a crashed or aborted request releases
    it when its connection closes or rolls back.
  - `LivePathsAsync` runs six slug-only queries per list or create. That is the same
    cost `OccupiesLivePathAsync` already has on every create.
- **Database permissions:** `sp_getapplock` needs only `public`. No grant changes.
  CI job `api` runs as `dh_content_app` (2.4), so the tests prove it under the
  restricted login.
- **Logins and secrets:** none. E1 uses the end-to-end admin, as the other specs do.
- **Dependencies:** none. No lockfile, package or workflow change.
- **Test-only code:** the T7 interceptor is registered only in the test project's
  `GatedApiFactory`. Nothing in `api/src` knows about it. T10's holder connection
  uses the test connection string, so it reaches `DigitalHubContent_Test` only, and
  it releases the lock by rollback in `finally`.

## 7. Migrations

None. No entity, column, index or constraint changes, and no row is rewritten.

**Existing rows, and what each now does:**

- **Redirects whose target has no page.** They still build, and the build now
  reports them. The Studio list marks them "No page". Staff fix them by deleting
  and re-adding, or by publishing the page.
- **Redirects to `/s/` whose item was already deleted or renamed before this
  change.** They stay as they are, and the list marks both kinds "No page", because
  `/s` is no longer a page. A deleted one points at nothing. A renamed one still
  works, through the chain `/s → /new`, but it chains instead of landing, which
  design 4.5 forbids. Staff fix either in the Studio by deleting the redirect and
  adding it again with the new target.
- **Redirects from an ended vacancy's address.** They would still build and still
  take the page over. New ones are refused.

None of this needs a migration. **And there are no such rows to fix.** The
coordinator reports the owner's read-only check of `DigitalHubContent_Studio` (on
the owner's machine, for O-ADM02-2): it found 0 redirects, and the build content
passed `check:content`. I have not seen that output myself; it is as the
coordinator relayed it on 11 November 2026. Other catalogs (`DigitalHubContent_E2e`
is reset before each run; `DigitalHubContent_Test` holds only test rows) need
nothing either.

## 8. Rollback

- Revert the pull request. Nothing is stored differently, so nothing needs cleaning
  up.
- Commits 3 to 7 can be reverted on their own:
  - reverting 4 removes the field and the marker;
  - reverting 5 removes the build report;
  - reverting 6 removes the lock;
  - reverting 7 restores F-2's old behaviour.
- After a revert, rows created under this change are valid under the old rules.

## 9. Owner decisions needed

- **O-ADM07-1. Status: ANSWERED.** Red test first for this change.
  - **Card, as relayed by the coordinator:** "For ADM-07, push the failing tests
    first, as with ADM-02?"
  - **The owner's answer:** "Yes, red tests first" (Mohamed Elbadry, 11 November
    2026, project thread; tapped on the card). I have not seen the thread myself.
    The words and their source come from the coordinator's message.
  - **What it allows:** the developer pushes commit 1 (tests only) to
    `change/ADM-07` and opens the pull request before the fix commits, so CI's
    `api`, `website` and `studio` jobs show the red (5.4). Commit 2 is pushed only
    after commit 1's run has finished those jobs.
  - **Read narrowly:** it covers this change's red-first push only. It is not an
    answer to anything else.

- **O-ADM07-2. Status: ANSWERED.** F-2, a redirect from a closed role's page.
  - **Card, as relayed by the coordinator:** "Should a redirect be refused from an
    ended vacancy's page?"
  - **The owner's answer:** "Yes, refuse it" (Mohamed Elbadry, 11 November 2026,
    project thread; tapped on the card). As above, relayed by the coordinator.
  - **How it is read:** round 1's option A. A redirect from an ended vacancy's
    address is refused like any live page (3.4, B6, T9). F-2 is in scope, so no
    D-NNN entry is needed.
  - **What staff do instead,** to send a closed role's address elsewhere: delete
    the ended vacancy (allowed, 2.5), then add the redirect. This is the plan's
    reading of the design, not part of the owner's words. It goes in the pull
    request body so the owner sees it at merge.

- **Behaviour changes, for the owner to see.** They go in the pull request body too.
  They are the fix itself, so they are not asked as separate decisions. Say so
  before gate 1 if any is not wanted.
  - **B1:** Creating a redirect to an address where no published page answers still
    succeeds (201). The response and the list now say `targetLive: false`.
  - **B2:** The Studio's Redirects screen marks such rows "No page", and after such
    a create it shows a warning instead of "Redirect created.". Rows become marked
    when their page is unpublished or deleted, too.
  - **B3:** The website build prints a "Redirect targets" report listing redirects
    whose target has no page. **The build does not fail on it.** The audit says
    "reports in the build". If the owner wants the build to stop instead, say so:
    one unpublish could then stop every build until the redirect is removed.
  - **B4:** Deleting an item also removes redirects to its address written with a
    trailing slash. Renaming a published item retargets them to the new address.
    Today both are missed.
  - **B5:** Redirect creates run one at a time. Two at once for one address give one
    201 and one `409 redirect_exists`; today they can give two 201s, or a 500. A
    create that waits more than 5 seconds for another one gets
    `503 redirect_busy`, "Another redirect is being saved. Try again." (T10)
  - **B6 (decided by O-ADM07-2, "Yes, refuse it"):** A redirect from an ended vacancy's address, with
    or without a trailing slash, is refused: `400 redirect_live_path`. So is such a
    row in a bundle import.

- **Already decided, not asked again:** ADM-02's B1 to B7 (accepted at merge of #54).
  O-ADM02-2: "List them, I pick fixes in Studio" (as relayed to this architect by
  the coordinator). Its read-only check has since found 0 redirects in
  `DigitalHubContent_Studio`, and that build content passed `check:content`, as the
  coordinator relayed. So this change has no existing rows to fix (section 7).

- **No owner decision is open for this change.**

## 10. Risks

| Risk | Effect | Caught by |
| --- | --- | --- |
| The API's idea of a page and the build's drift apart | A false "No page", or a missed one | Both use the build's items: the API reads the same statuses as `BuildContentStore`, and the website reads `out/`. K2 locks the fixed pages and the error pages. T3 and W2/W3 pin the edge cases on both sides |
| A new fixed page is added to the website (another `src/app/<name>/page.tsx`) | The API calls it "No page" | K2 fails when `staticFiles` changes without `RedirectTargets.StaticPaths` |
| T7's interceptor matches the wrong command, or none | The red is not real, or the test hangs | The match is "a parameter whose value contains the marker", which fits both EF 10 parameter shapes. The developer confirms the command text from the EF log. The gate releases after 2 s at most. T7 fails if the gate saw no command. T7's red messages must show two 201s, or a 201 and a 500 |
| A cold factory spreads T7's two requests more than 2 s apart | T7 is green at the red commit | The warm-up before arming (5.1) |
| The gate cap and the lock timeout are changed apart | T7 turns into a 503 at green | Both numbers sit side by side in a test comment: the cap (2 s) must stay well under the lock timeout (5 s) |
| A cold start under the lock gives T8 a `redirect_busy` | A 503 that is not a defect | The same warm-up before round 1. T8's slowest request per round is quoted (5.4) |
| The busy branch maps to 500, inserts a row, or waits on a different lock name | A broken B5 nobody sees | T10 holds the documented lock from a separate connection and asserts 503 `redirect_busy` and no row |
| Studio tests render a real antd toast | The ADM-06b-flake failure returns ("window is not defined" after the file ends) | S1 and S3 assert on spies for `message.success` and `message.warning`, and the file's `afterEach` asserts an empty body |
| The build report's file lookup follows the file system's case rules | W3 passes on Linux and fails on Windows | The lookup is in the walked file list, ordinally (3.1) |
| T8 is green at the red commit | The ungated proof looks weaker | Stated in 5.1. T7 is the deterministic red, and T8 is reported as it ran |
| The lock is held too long, or leaks | Creates fail with 503 | Transaction-owned: released on commit, rollback or connection close. 5 s timeout. T10 shows the timeout path and that the next create succeeds once the holder rolls back. `paging.spec.ts` (51 sequential creates) and T8 (8 at once) show it under load |
| `sp_getapplock` is not allowed for `dh_content_app` | Every create fails | CI `api` runs as `dh_content_app` (2.4); every redirect test would fail there |
| A rename races a manual create into a loop through different keys | A loop the build writes | Not fixed (3.3). Needs two people at the same instant. Visible in the list. If the owner wants it closed, `RetargetAsync` can take the same lock in a follow-up |
| `OccupiesLivePathAsync` calls `/error-404` and `/error-500` live | A redirect from those unused addresses is refused | Harmless: it only refuses more. Out of scope (section 4) |
| The Studio warning is easy to dismiss | Staff ignore it | The marker stays in the list. The build report repeats it |
| Existing redirects to `/s/` of renamed items get marked "No page" | Staff see more warnings after the merge | 7 explains it. It is correct: they chain instead of landing. The owner's check found no redirects in `DigitalHubContent_Studio`, so none exist today |
| The red unit test hides E1 in CI | No end-to-end red evidence | 5.2 puts the Studio unit tests in commit 2, pushed after commit 1's CI has finished |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `/blogs/<live-slug>/` refused (bullet 1) | Audit ADM-07 | Closed by ADM-02 (#54); end-to-end proof here (E1 step 1) | |
| `/a → /a/` refused (bullet 2) | Audit ADM-07 | Closed by ADM-02 (#54); end-to-end proof here (E1 step 2) | |
| Path normalisation | Audit ADM-07, Fix | Closed by ADM-02 (#54) | |
| A target with no page is detected by the API, by the build's own rule | Audit ADM-07, bullet 3 | Planned | |
| The Studio warns: on create, and per row in the list | Audit ADM-07, Fix ("warns in the Studio") | Planned | |
| The build reports redirects with no page | Audit ADM-07, Fix ("reports in the build") | Planned | |
| Phase C 10.7 "Every redirect in the table resolves to a page returning 200"; BA 530 "checks every redirect lands on a live page" | Phase C; business analysis | Partly: reported, not enforced (B3). The IIS-level check is Phase D | |
| API and website agree on the fixed and error pages (drift guard) | Found here (3.1) | Planned | |
| `ToPath` compared by address in `DeleteAsync` | ADM-02 plan 2.2 and 4, handed over | Planned | |
| `ToPath` compared by address in `RetargetAsync` | ADM-02 plan 2.2 and 4, handed over | Planned | |
| End-to-end test for the Major | G3 checklist; ADM-02 plan 3.4 | Planned | |
| F-1: check and insert are one unit; concurrent creates of one address give exactly one 201 | ADM-02 test report F-1; delivery approval | Planned | |
| F-1: a create that cannot get the lock in time is `503 redirect_busy`, with no row (B5) | Review round 1 finding 1 | Planned | |
| F-2: a redirect from an ended vacancy's address is refused, at create and at import | ADM-02 test report F-2; delivery approval; O-ADM07-2 "Yes, refuse it" | Planned | |
| Regression tests committed and shown failing before the fix | G3 checklist; refinement plan Track G3; O-ADM07-1 "Yes, red tests first" | Planned | |
| No regression in the DB-free baseline (175 at `6262f48`, 176 with `npm ci`) | P-8 | Planned | |
| Warning at unpublish | Considered here | Out of scope (ADM-14, ADM-20) | |
| Readable refusal messages in the Redirects modal | Found here (2.2) | Out of scope (ADM-14) | |
| A rename racing a manual create into a loop | Found here (3.3) | Out of scope, in risks (10) | |

## 12. Revision log

- **Round 1 (11 November 2026, `4b66664`):** first version. There was no
  `plan-review.md`, `plan-approval.md` or `implementation.md` for ADM-07 yet.
- **Round 2 (11 November 2026).** Answers `plan-review.md` Round 1 (`df3af90`,
  CHANGES NEEDED), point by point:
  1. **Major, no test for `503 redirect_busy`.** Added T10,
     `A_create_that_cannot_get_the_lock_in_time_is_refused_as_busy`, in
     `RedirectConcurrencyTests.cs`, in commit 1. A separate `SqlConnection` holds
     `sp_getapplock` on `N'digitalhub:redirects'` in an open transaction. The POST
     must give `503 redirect_busy` and leave no row. After rollback, the same POST is
     201. It is red at base (201 at once), so it also proves the resource name.
     Added to 3.3, 4, 5.2 (commit 6 makes it green), 5.4's red list, B5, section 10
     and the coverage table.
  2. **Minor, T7's gate.** The match is now "a parameter whose value **contains**
     the marker", which covers EF Core 10's scalar and JSON-array parameter shapes.
     The developer still confirms the text from the EF log. Added a warm-up (one
     create and delete through the same factory) before arming. Wrote down the
     coupling: the gate's 2 s cap must stay well under the 5 s lock timeout, with
     both numbers side by side in a test comment. All in 5.1, with risk rows in 10.
  3. **Minor, T8 cold start.** The same warm-up before round 1. T8 writes each
     round's slowest request time, and 5.4 quotes it. A `redirect_busy` in T8 at
     green is reported as a failure.
  4. **Minor, Studio toasts.** S1 and S3 now assert on spies for both
     `message.success` and `message.warning` (call and text), mocked as
     `listPaging.test.tsx:63-67` does. The file keeps the empty-body `afterEach`
     (`listPaging.test.tsx:165-169`). S2's marker is inside `render()`'s root, so it
     is still asserted as text.
  5. **Minor, ordinal file lookup.** `redirectTargetReport` looks files up in the
     walked file list (`walk(outDir)` into a `Set`, as `checkOutput` builds
     `fileSet` at `check-output.ts:105-106`), never with `fs.existsSync`. 3.1 and W3
     say so.
  6. **Minor, the 201 rationale and 10.7.** 2.2 and the 3.5 row now rest on the
     audit's "warns" and on Phase B 4.5 and 8.3 (chains to another redirect's
     source are accepted and collapsed). The `AdminApiTests` 201s are named as a
     consequence, not a reason. The P-6 claim is removed. The coverage table now
     has a separate row: Phase C 10.7 and BA 530 are "Partly: reported, not
     enforced (B3). The IIS-level check is Phase D".
  - **Owner answers recorded** (section 9), as relayed by the coordinator:
    O-ADM07-1 "Yes, red tests first" and O-ADM07-2 "Yes, refuse it" (Mohamed
    Elbadry, 11 November 2026, project thread). So F-2 is in scope without
    conditions: T9 (formerly T9-A) is in commit 1, commit 7 is unconditional,
    T9-B and the D-NNN fallback are removed, and B6 is no longer conditional.
  - **O-ADM02-2 context recorded** (sections 7, 9, 5.5): the owner's read-only
    check found 0 redirects in `DigitalHubContent_Studio`, and that build content
    passed `check:content`. So there are no existing rows to fix, and 3.4's note
    about widening query (b) is withdrawn.

## Owner decisions, in brief

Section 9 has the full wording. Both questions are answered, as relayed by the
coordinator. No owner decision is open.

- **O-ADM07-1:** "Yes, red tests first" (Mohamed Elbadry, 11 November 2026, project
  thread). Commit 1 (tests only) is pushed first, so CI shows the red.
- **O-ADM07-2:** "Yes, refuse it" (same date and place). A redirect from an ended
  vacancy's page is refused. F-2 is fixed here, and no D-NNN entry is needed.
- **B1 to B6:** behaviour changes for the owner to see at merge. B3 is the one to
  object to before gate 1 if a failing build is wanted: the build reports a
  missing target, and does not fail.
