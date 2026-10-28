# Gap analysis and refinement plan

28 October 2026 · Mohamed Elbadry (owner). Working copy: the Gap analysis & refinement plan tab of the Digital Hub Platform — Test & Quality Report doc; this file is the reviewed snapshot.

The code is sound; the gaps are in automation and process. 31 of the standard's 54 rules are not fully met. The plan closes 24 of them by 14 December 2026 (22 if OpenAPI is declined) in four waves of 26 pull requests, starting with this week's security deadline. Three rules stay review-only by design, and four wait on Phase D or an owner decision.

Final version, after an independent review on 28 October; what the review changed is listed under Revision notes. Restructured later on 28 October around the owner's three goals (next section).

## Three goals and the order to do them

The owner set three goals on 28 October: "1 revamp the portal so it follows the standard 2 isolate the admin portal from the public portal 100% 3 the admin functions to control the portal had many issues that will block the portal management". Each is a track. Track G1 is the four waves below, unchanged. Track G2 is option B from ADR 0001. Track G3 is the 25 findings of `docs/quality/admin-audit-2026-10-28.md`.

| Track | Goal | Items | Done when |
| --- | --- | --- | --- |
| G1 Standard | The system follows `ENGINEERING_STANDARDS.md` | GAP-01 to GAP-35, Waves 0 to 4 | 47 of 54 rules met by 14 December |
| G2 Isolation | The Studio is separated from the website on the server too, not only in the browser | ISO-1 to ISO-6, which replace the GAP-36 and GAP-38 approach | The website's domain reaches only the two public forms, through their own API and login; the admin API answers only on the Studio host; the Studio subdomain is on an allow-list (Phase D) |
| G3 Admin functions | Staff can run the website from the Studio without a developer | ADM-01 to ADM-25 | All six blockers fixed by 16 November, the Majors by 11 December, the Minors by 18 December; ADM-01b with Phase D |

### Execution order

Two merge slots a working day: slot 1 carries G1 at the pace already planned; slot 2 carries G2 and G3, one pull request a day at most. One integrator merges both, one at a time, and re-runs the suites after each (`AGENTS.md`). Parallel pull requests change different files.

| Step | Dates | Slot 1 | Slot 2 | Why here |
| --- | --- | --- | --- | --- |
| 1 | 28 Oct to 3 Nov | Wave 0: security deadline | Owner decisions in one round, ADR 0001 reviewed and accepted | The deadline is fixed, and every later step waits on a decision |
| 2 | 3 to 16 Nov | Wave 1: make CI honest | G3-1: the admin blockers (ADM-06, 03, 02, 07, 10, 05, 04, 12, 01a) | Blockers are small and staff need them before content work starts; CI that tells the truth checks them as they land |
| 3 | 17 Nov to 4 Dec | Wave 2 (17 to 25 Nov), then Wave 3 from 26 Nov | G2: ISO-1 to ISO-5, the split, between G3-2 items | ADR accepted and CI honest first; the split lands before the Wave 3 route list, so the list is written once for two APIs |
| 4 | 26 Nov to 11 Dec | Wave 3, route list (GAP-23, GAP-36) merged after ISO-4 | G3-2: the Majors (ADM-11 first) | The route list and host test cover both APIs |
| 5 | 14 to 18 Dec | Wave 3 gates block 14 Dec | G3-3: the Minors | Friction last |
| 6 | Phase D | Wave 4 | ISO-6 (allow-list O-13, exposure test GAP-37), ADM-01b publish to build to deploy | Need the servers |

G2 adds one to two weeks against the GAP-36 and GAP-38 approach; it fits slot 2 without moving a G1 date. G3 adds 17 pull requests to slot 2.

## Where it stands

Quality gates are the weakest area at 1 of 15 rules met; security is mostly met and the API half met. Measured against `ENGINEERING_STANDARDS.md` on `rebuild/dotnet-platform` at `6470fac`, with the test run of 27 October 2026.

| Area | Rules | Met today | Partly met | Missing | Not yet applicable | Met after Wave 3 (planned) |
| --- | --- | --- | --- | --- | --- | --- |
| Principles | 8 | 4 | 4 | 0 | 0 | 7 |
| Branches and pull requests | 9 | 5 | 4 | 0 | 0 | 7 |
| Quality gates | 15 | 1 | 7 | 5 | 2 | 12 |
| Security | 8 | 6 | 1 | 1 | 0 | 8 |
| API | 14 | 7 | 5 | 1 | 1 | 13 |
| **Total** | **54** | **23** | **21** | **7** | **3** | **47** |

Seven rules stay open after Wave 3. P-4 (attack tests from the design), B-2 (branch cut from the current base) and B-5 (exact paths, no other worker's changes) have no machine check and stay review-only by design. The deploy guard (G-14), image scanning (G-12) and the exposure and dynamic scans (A-14) start with Phase D. CodeQL (G-10) waits on a decision.

The 47 rests on two conditions. If OpenAPI is declined, A-1 and A-12 stay open (45). If the GitHub plan does not allow branch protection on a private repository, P-1 stays open (46, or 44 with both).

## Priority matrix

*Diagram in the doc: the 38 gaps on a 3×3 grid of impact and effort, from the register's Impact and Effort columns. The seven High-impact, Low-effort gaps are GAP-01, 02, 03, 04, 05, 07 and 37.*

Start top left: six of the seven Do first gaps land in Waves 0 and 1; GAP-37 waits for Phase D, because it tests the deployed routing. The Plan and fund cell needs an ADR, a new dependency or Phase D. GAP-33 (CodeQL) sits alone in Question because it may cost more than Semgrep already gives.

## Gap register

38 gaps. 26 rows cover the 31 rules not fully met; the other 12 cover defects the test run found, two rollout steps of the standard that no rule names, and three isolation gaps between the Studio and the website found on 28 October. Fourteen are high impact, and seven of those take low effort. Impact and effort are my assessment; change the dropdowns where you see it differently.

### Waves 0 and 1: now to 16 November

| ID | Area | Rule or finding | Today | Target | Impact | Effort | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GAP-01 | Security | S-7; findings 1, 3, 7 | Website: 2 Critical and 2 High in `next`, and High in `sharp`, `source-map-js`, `vite`, `undici`. Studio: High in `vite`, `undici`, `source-map-js`. Three allowed since 13 Oct with no expiry | 0 Critical or High in either app's full dependency tree, or a D-NNN exception with an expiry for each | High | Low | Wave 0 |
| GAP-02 | Security | G-1; finding 2 | Weekly scans and Dependabot updates have never run: the default branch is `main` | Weekly full-history secret scan and audits run on the integration branch, and Dependabot updates are triaged | High | Low | Wave 0 |
| GAP-03 | Process | P-1, B-5 | No branch protection recorded on `rebuild/dotnet-platform` | Pull request required, CI and Security required, force-push blocked (a private repository needs a paid GitHub plan) | High | Low | Wave 0 |
| GAP-04 | Front End | Finding 6 | 29 Playwright browser tests run nowhere | Both website builds and their browser tests run on every pull request | High | Low | Wave 1 |
| GAP-05 | Front End | Locked design; finding 5 | Section and screenshot comparisons are `continue-on-error`; 1 unaccepted section difference passes | Both comparisons block, or the screenshot one has a recorded exception; 0 unaccepted differences | High | Low | Wave 1 |
| GAP-06 | Database | G-4; finding 4 | CI migrates from empty only; the idempotent script fails at migration 7 of 15, and migration 14 has the same pattern | CI applies from empty, from the previous schema, and the script twice | High | Medium | Wave 1 |
| GAP-07 | Security | G-11; finding 7 | Production packages audited only; allow-list has no expiry | Full tree audited; each allow-list entry cites a D-NNN exception and expires | High | Low | Wave 1 |
| GAP-08 | CI | G-13 | No workflow lint; only `security.yml` checked against golden copies | actionlint on every workflow, 0 findings | Medium | Low | Wave 1 |
| GAP-09 | CI | G-15 | Actions on major tags (`@v4`); SQL Server image `2022-latest`; Node `22` and .NET `10.0.x` float | Actions by commit SHA, the image by digest, Node and .NET exact | Medium | Low | Wave 1 |
| GAP-10 | Database | G-3 | Production SQL Server version not recorded | CI runs the production major version | Medium | Low | Wave 1 |
| GAP-11 | Security | Supply chain (standard, section 8); finding 8 | GSAP from `cdn.jsdelivr.net` with no integrity hash or fallback | Integrity hash on every third-party script, or self-hosted | Medium | Low | Wave 1 |
| GAP-12 | API | Finding 9 | `Server: Kestrel` on every response | No server header | Low | Low | Wave 1 |
| GAP-13 | Process | Records (standard, section 11) | No ADRs, CODEOWNERS or build log; `AGENTS.md` and `CLAUDE.md` still say "Phase C is next" | The first five ADRs, CODEOWNERS, a build log, and a current status in both files | Medium | Low | Wave 1 |
| GAP-14 | Compliance | Project profile; O-6 | Data-protection law and contact-enquiry retention not named | Both named in the profile and mapped to a rule and a test | Medium | Low | Wave 1 |
| GAP-34 | Process | Rollout step 2 (standard, section 15) | The standard's roles (planner, architect, approver, testers) are not mapped onto the `AGENTS.md` builder and checker rotation | Each role named against an agent and a stage in `AGENTS.md` | Low | Low | Wave 1 |

### Waves 2 to 4, and one decision

| ID | Area | Rule or finding | Today | Target | Impact | Effort | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GAP-15 | Process | S-3, P-4 | Red test before a security fix is checked by review only | A red-test commit is visible before every security fix commit | Medium | Low | Wave 2 |
| GAP-16 | CI | G-5 | No ESLint, no .NET analyzer settings | 0 new issues; existing ones in a shrink-only baseline | Medium | Medium | Wave 2 |
| GAP-17 | Back End | G-6; finding 10 | 13 nullable warnings, not counted | Warnings counted; 0 new; the 13 fixed or baselined | Medium | Low | Wave 2 |
| GAP-18 | CI | G-8 | Coverage measured once (88.4% of API code), not in CI | Collected on every pull request; at least 80% of changed lines; the floor only rises | Medium | Low | Wave 2 |
| GAP-19 | CI | G-7 | No formatter check | 0 unformatted new files | Low | Low | Wave 2 |
| GAP-20 | CI | G-9 | No duplication check | At most 3% duplication in changed code | Low | Medium | Wave 2 |
| GAP-21 | Process | P-2, P-6 | Only the security gate has a baseline and a self-test | Every gate baselined, with a committed fixture that fails CI if the gate is loosened | Medium | Medium | Wave 2 |
| GAP-22 | Process | B-2, B-4, B-6 | Branch, commit-message and test-order rules checked by review only | Commit-message and pull-request-body checks in CI (B-2 stays review-only) | Low | Low | Wave 2 |
| GAP-23 | API | A-2 | The role matrix walks every route, but no route list is committed | Golden route file; CI fails on a new or unguarded route | High | Medium | Wave 3 |
| GAP-35 | Security | Rollout step 5 (standard, section 15) | Every route is in the role matrix, but no recorded review of each route's policy and its residual risks | The review recorded; residuals as D-NNN entries with expiries | Medium | Low | Wave 3 |
| GAP-24 | API | A-1 | No OpenAPI document | OpenAPI generated from the code; contract test in CI | High | High | Wave 3 |
| GAP-25 | API | A-5 | Unknown fields rejected on the one write checked; other bodies unverified | A test proves every request body on the route list rejects unknown fields | Medium | Low | Wave 3 |
| GAP-26 | API | A-12 | Studio calls the API from `http.ts` and `session.ts`; responses not schema-checked | One typed client; responses checked against the schema | Low | Medium | Wave 3 |
| GAP-27 | API | A-6; O-5 | Correlation id in the response header only | `correlationId` in every error body too | Low | Low | Wave 3 |
| GAP-28 | API | A-13 | `/health` reports no schema version | `/health` names the last applied migration | Low | Low | Wave 3 |
| GAP-29 | API | Finding 11 | First admin keeps the configured password | First admin must change it at first sign-in | Low | Low | Wave 3 |
| GAP-30 | Deployment | G-14; O-3 | No deploy workflow or deploy guard; pull requests squash-merged | Deploy guard as the first deploy job; merge method decided | High | High | Wave 4 |
| GAP-31 | Deployment | A-14; O-10 | No exposure test, proxy test suite or dynamic scan | Only the proxy listens publicly; HTTP suite through it; baseline scan triaged | High | High | Wave 4 |
| GAP-32 | Deployment | G-12 | No images built (IIS) | Image scanning, if Phase D uses containers | Low | Low | Wave 4 |
| GAP-33 | Security | G-10 | CodeQL skipped on a private repository | CodeQL enabled, or Semgrep accepted as the only analyser | Low | High | Decision |

### Isolation gaps, added 28 October

The Studio and the website are separated in the browser (own subdomain, host-only cookies, no CORS, no admin code in the built site) but not on the server: one API process and one database login serve both, and only the planned IIS routing keeps admin routes off the website's domain. The owner chose option B, two APIs (O-12, decided). GAP-36 and GAP-38 are now met by Track G2 below; GAP-37 stays with Wave 4.

| ID | Area | Rule or finding | Today | Target | Impact | Effort | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GAP-36 | Security | Isolation review | The API answers every route on any host (`AllowedHosts: "*"`); only IIS routing would keep admin and auth routes off the website's domain | The admin API answers only on the Studio host and has no `/public/` route; the public API has only its two routes; the route-list test proves both | High | Medium | G2 (ISO-4), test in Wave 3 |
| GAP-37 | Deployment | Isolation review; A-14 | Nothing checks the deployed routing of the website's domain | The exposure test proves every non-public route returns 404 through the website's domain, and the Studio subdomain still answers | High | Low | Wave 4 |
| GAP-38 | Database | Isolation review; O-12 | The public contact and apply endpoints use `dh_content_app`, which can read and write every table, users and sessions included | The public forms run in their own API with their own login `dh_public_forms`, limited to four tables (ADR 0001) | High | High | G2 (ISO-2, ISO-3) |

## Why the gaps exist

Three causes account for 33 of the 38 gaps; the other five (GAP-30 to 32, 37 and 38) wait on Phase D.

- **CI shows green while it cannot see.** The section and screenshot comparisons are `continue-on-error`, the audit skips development packages, the browser suite is not wired in, and the schedules sit on a branch with no workflows. Each looks like a pass. Closing these comes first, because every later gate depends on CI telling the truth (GAP-02, 04, 05, 06, 07, 10).
- **Rules held by people, not machines.** Test-first, commit format, no force-push and "never weaken a gate" are written in `AGENTS.md` and the standard, but nothing checks them, so they hold only while everyone remembers (GAP-03, 13, 14, 15, 21, 22, 34).
- **Hardening deferred while features shipped.** Phases A to C built the product with strong tests and security scans, but dependency upgrades, lint, formatting, coverage, the route list, an API contract and smaller hardening items were left for later (GAP-01, 08, 09, 11, 12, 16 to 20, 23 to 29, 33, 35, 36).

The fix pattern follows from the causes: make CI honest, then turn written rules into checks, then add each missing gate in report mode with a baseline, as the standard prescribes.

## Refinement roadmap

*Diagram in the doc: a timeline of the waves. Wave 0 merges 28 Oct–3 Nov; Wave 1 merges 3–16 Nov, gates block 23 Nov; Wave 2 merges 17–25 Nov, gates block 2 Dec; Wave 3 merges 26 Nov–7 Dec, gates block 14 Dec.*

Each bar is the days a wave's pull requests merge, one per working day; the thin line is the seven-day report mode; the diamond is the date its gates block, which is the wave's exit gate. Wave 4 has no date until Phase D is scheduled.

## Wave by wave

26 pull requests for Waves 0 to 3, merged one per working day, plus two GitHub settings the owner changes and the Dependabot pull requests the default-branch switch starts. Each pull request has one topic, is built by one agent and checked by another, as `AGENTS.md` requires. Each wave is a section in the `AGENTS.md` sense: it stops at its exit gate until the owner confirms. Every new gate reports for seven days after it merges (a `*_BLOCKING_FROM` date in the workflow), then blocks; a gate that replaces existing protection blocks at once (standard, section 6).

### Wave 0: security deadline, 28 October to 3 November

Goal: no Critical or High advisory left in either app, production or development packages, without a fix or an owner exception. Exit gate: Security is green on `rebuild/dotnet-platform`, the first scheduled run has appeared, and the owner confirms. Waits on O-1, O-2, O-7 and O-9.

| Item | Closes | By | Done when |
| --- | --- | --- | --- |
| Upgrade the website to `next` 16.4.3, refresh `sharp` and `source-map-js`, and update `vite`, `undici` and `vitest` in both apps | GAP-01 | Agent | `npm audit --audit-level=high` on the full tree reports 0 in the website and the Studio; the website entries are removed from `known-findings.json`; tests, design check, build and section comparison are green; the screenshot report is reviewed by hand, since that step cannot fail yet |
| Record an exception for any advisory the upgrade cannot fix | GAP-01 | Owner, then agent | Each remaining advisory cites a D-NNN entry in `docs/deferred-items.md` that quotes the owner and has an expiry |
| Make `rebuild/dotnet-platform` the default branch | GAP-02 | Owner | A Security run with event `schedule` appears after Monday 2 November, 03:41 UTC |
| Protect `rebuild/dotnet-platform`: pull request required, CI and Security required, force-push blocked | GAP-03 | Owner | The rule shows in the branch settings or the branch-protection API, and the same rule refuses a push on a throwaway branch. Never tested by pushing to `rebuild/dotnet-platform`. A private repository needs a paid GitHub plan for this (O-9) |
| Triage the Dependabot pull requests the default-branch switch starts (up to 5 per ecosystem, 4 ecosystems) | GAP-02 | Agent, checked by another | Grouped minor and patch updates merged or closed; each `github-actions` bump carries the matching golden-copy update in `.github/security/` |

### Wave 1: make CI honest, 3 to 16 November

Goal: every suite that exists runs in CI and can fail. Ten pull requests. Exit gate: all ten merged, each new gate blocking from its own date (the last on 23 November), and the owner confirms. Waits on O-4, O-6, O-8 and O-11.

| Item | Closes | By | Done when |
| --- | --- | --- | --- |
| Run the website browser suite in CI, with the default and the consent build | GAP-04 | Agent | A job runs all 29 tests on every pull request with 0 failures, and blocks after its report week |
| Restore or accept the careers apply section; make the section comparison blocking; make the screenshot comparison blocking or except it until its register has approved entries | GAP-05 | Agent; owner decides O-11 | `continue-on-error` is gone from the section comparison, which reports 0 failures; the screenshot step blocks or has a D-NNN entry |
| Fix every migration the idempotent script cannot apply (`NavigationLinkRefs`, and `AddRefreshTokenSessionStart`, which has the same add-column-then-SQL pattern) by wrapping the raw SQL in `EXEC`; add migration checks to CI | GAP-06 | Agent | CI applies the idempotent script twice to an empty catalog and upgrades from the previous schema, both exit 0. Each migration change is shown before it is applied, as `AGENTS.md` requires |
| Audit the full dependency tree; every allow-list entry cites a D-NNN and expires | GAP-07 | Agent | The gate includes development packages, fails on an expired entry (proven by a self-test), and blocks at once, since it replaces the existing audit |
| Add actionlint | GAP-08 | Agent | 0 findings across all workflows |
| Pin every action by commit SHA, the SQL Server image by digest at the production major version, and Node and .NET to exact versions | GAP-09, GAP-10 | Agent | Every `uses:` names a 40-character SHA; the image reference carries `@sha256:`; `node-version` and `dotnet-version` are exact |
| Add integrity hashes to the GSAP scripts, or serve them from the site | GAP-11 | Agent | Every external script in the built pages carries `integrity` |
| Remove the `Server` header | GAP-12 | Agent | An integration test asserts no `Server` header on API responses |
| Records: `docs/adr/` with the first five ADRs, CODEOWNERS, a build log, a current status in `AGENTS.md` and `CLAUDE.md`, and the standard's roles mapped onto the `AGENTS.md` rotation | GAP-13, GAP-34 | Agent | The files exist and a new pull request requests the owner's review automatically (O-9) |
| Name the data-protection law and the retention period in the profile | GAP-14 | Owner, then agent | Each requirement maps to a rule id and the test that proves it |

### Wave 2: quality gates, 17 to 25 November

Goal: lint, warnings, coverage, formatting and duplication enforced, each with a baseline. Seven pull requests. Exit gate: all seven gates blocking by 2 December, and the owner confirms.

| Item | Closes | By | Done when |
| --- | --- | --- | --- |
| ESLint for website and Studio, with a baseline | GAP-16 | Agent | 0 new issues; the baseline only shrinks |
| .NET analyzers with warnings counted | GAP-16, GAP-17 | Agent | 0 new warnings; the 13 nullable warnings fixed or baselined |
| Coverage collected in CI (coverlet and Vitest) | GAP-18 | Agent | Each pull request shows changed-line coverage; below 80% fails after the report week |
| Formatting check on new files | GAP-19 | Agent | 0 unformatted new files |
| Duplication check on changed code | GAP-20 | Agent | At most 3% duplication |
| A canary fixture for every gate | GAP-21 | Agent | Each gate has one committed fixture it must reject, run in CI, so loosening the gate turns CI red |
| Commit-message and pull-request checks | GAP-15, GAP-22 | Agent | CI checks the commit subject and the Definition of Done boxes; a security fix shows its failing-test commit before the fix |

### Wave 3: API assurance, 26 November to 7 December

Goal: no route or response shape can change unnoticed. Eight pull requests. Exit gate: the route list and the contract test blocking by 14 December, and the owner confirms. Waits on O-5, and on the owner approving a new dependency for OpenAPI through an ADR.

| Item | Closes | By | Done when |
| --- | --- | --- | --- |
| Committed route list with each route's policy and the host it answers on; admin and auth routes refused on any other host | GAP-23, GAP-36 | Agent | Adding a route without updating the list, or without a policy, fails CI; a test sends every non-public route with the website's host and gets 404 |
| Review every route's policy; record residuals with expiries | GAP-35 | Agent, checked by another | The review is recorded; each residual is a D-NNN entry with an expiry |
| OpenAPI document generated from the code, and a contract test | GAP-24 | Agent | CI fails when a response differs from the document |
| A test that every request body rejects unknown fields | GAP-25 | Agent | The test takes its write routes from the GAP-23 route list |
| One typed Studio client with response checks | GAP-26 | Agent | No `fetch` outside the client; responses validated against the schema |
| `correlationId` in every error body | GAP-27 | Agent | The error-shape test checks the field |
| Schema version on `/health` | GAP-28 | Agent | `/health` names the last applied migration |
| First admin changes the configured password | GAP-29 | Agent | An integration test asserts `mustChangePassword: true` for the first admin |

### Wave 4: deployment assurance, with Phase D

Goal: the standard's release rules from the first deploy. No date until Phase D is scheduled. Waits on O-3, O-8, O-10, O-12 and O-13; the CodeQL choice (GAP-33) can be made at any time.

| Item | Closes | By | Done when |
| --- | --- | --- | --- |
| Deploy guard as the first job of the deploy workflow; merge method decided | GAP-30 | Agent; owner decides O-3 | The guard's self-test passes and it refuses a commit not covered by a merged, green pull request |
| Exposure test, HTTP suite through the proxy, baseline dynamic scan | GAP-31, GAP-37 | Agent; owner decides O-10 | Only the proxy answers from outside; every non-public route returns 404 through the website's domain; the suite and the scan run against the environment O-10 names |
| Image scanning, if Phase D uses containers | GAP-32 | Agent | 0 unlisted High or Critical in the built images |
| Enable CodeQL, or accept Semgrep alone | GAP-33 | Owner | CodeQL runs, or a recorded owner decision says it is not needed |
| Allow-list the Studio subdomain and prove the website's domain reaches only the public forms | GAP-37, ISO-6 | Agent; owner decides O-13 | See Track G2 |

### Track G2: isolation, option B

ADR 0001 (`docs/adr/0001-split-public-forms-api.md`) holds the design. Five pull requests from 17 November to 4 December, then ISO-6 with Phase D. Exit gate: ISO-1 to ISO-5 merged, both APIs green in CI, and the owner confirms.

| Item | Closes | By | Done when |
| --- | --- | --- | --- |
| ISO-1: move the contact and apply code (validation, intake, throttles, dedupe, email) into a `DigitalHub.Forms` library; no behaviour change | GAP-38 | Agent | All 208 integration tests and the 22 end-to-end tests pass unchanged |
| ISO-2: new `DigitalHub.PublicApi` with only `POST /api/v1/public/contact` and `/apply`, its own small DbContext over four tables, no Identity, no signing key | GAP-38 | Agent | Its own integration suite passes against `DigitalHubContent_Test`; a test proves every other path returns 404 |
| ISO-3: `dh_public_forms` login: INSERT on `contact_requests`; SELECT, INSERT, UPDATE on `application_counts`; SELECT on `vacancies` and `site_settings` | GAP-38 | Agent; migration shown first | A permission test, like `AuditLogPermissionTests`, proves it cannot read users, roles, sessions or audit, or change content |
| ISO-4: the admin API drops `/api/v1/public/*`; `AllowedHosts` is the Studio host in Production. Merged after ISO-5 | GAP-36 | Agent | A test sends every admin route with the website's host and gets 400 or 404; the Studio end-to-end suite still passes |
| ISO-5: the website's `web.config` proxies `/api/v1/public/*` to the public API and nothing else; the website end-to-end form tests run against the public API | GAP-36 | Agent | The generated `web.config` has exactly that one proxy rule; the contact and apply browser tests pass |
| ISO-6, Phase D: Studio subdomain behind the office and VPN allow-list, with the build machine on it; the exposure test | GAP-37 | Agent; owner decides O-13 | From outside the list, the Studio host does not answer; through the website's domain only the two forms answer |

### Track G3: admin functions

The findings, their evidence and their fixes are in `docs/quality/admin-audit-2026-10-28.md`. Every fix carries a regression test that fails first. Each batch is a section: it stops at its exit gate until the owner confirms.

| Batch | Dates | Items | Exit gate |
| --- | --- | --- | --- |
| G3-1, Blockers | 3 to 16 Nov | ADM-06 paging, ADM-03 rich-text images, ADM-02 and ADM-07 redirect and schema checks, ADM-10 settings share image, ADM-05 error pages, ADM-04 role change and reactivation, ADM-12 alt text in the library, ADM-01a build status in the Studio | A clean website build from `DigitalHubContent_Studio` with no patched content; each blocker reproduced before its fix and passing after it |
| G3-2, Majors | 17 Nov to 11 Dec | ADM-11 lockout first, then ADM-08 conflicts, ADM-09 sections, ADM-14 confirmations and messages, ADM-13 navigation, ADM-15 audit filters, ADM-16 media, ADM-17 blog FAQ | The end-to-end suite has a test per item; the three reviews' scripts re-run clean |
| G3-3, Minors | 14 to 18 Dec | ADM-18 to ADM-25 | Each fixed or a D-NNN entry with an expiry |
| Phase D | — | ADM-01b: publishing, or a Publish website action, starts the build and deploy (O-14) | A published change appears on the staging site with no developer step |

## Success measures

Eleven measures tell whether the plan is working. Ten are read from CI or the repository; the first is the standard's status column, which each pull request that closes a rule updates.

| Measure | Today, 27 Oct | Target | By | Read from |
| --- | --- | --- | --- | --- |
| Standard rules met | 23 of 54 | 47 of 54 (45 if OpenAPI is declined) | 14 Dec | Status column of `ENGINEERING_STANDARDS.md` |
| Packages with an open Critical or High advisory and no fix or exception | 8 (5 website, 3 Studio) | 0 | 3 Nov | Full-tree `npm audit` in both apps |
| Scheduled security runs | 0, ever | 1 a week | From 2 Nov | Actions runs with event `schedule` |
| Test suites that exist but do not run in CI | 1 (29 browser tests) | 0 | Merged 16 Nov, blocking 23 Nov | `ci.yml` |
| CI checks that cannot fail (`continue-on-error`) | 2 (section and screenshot comparisons) | 0, or a recorded exception each | 16 Nov | The workflows |
| Migrations the idempotent script can apply | 6 of 15 | 15 of 15 | 16 Nov | CI migration job |
| Gates with a canary fixture | 1 (security) | Every gate | 14 Dec | CI |
| Line coverage of API code | 88.4%, measured once | Measured on every pull request; at least 80% of changed lines | Blocking 2 Dec | CI coverage report |
| Uncounted build warnings | 13 | 0 new | Blocking 2 Dec | Release build |
| Routes in a committed list | 0 | Every route | Blocking 14 Dec | Route-list test |
| Non-public routes that answer through the website's host | Not tested; the API accepts any host | 0, proven by a test | Blocking 14 Dec | Route-list host test |
| Database logins that can read users and sessions and are reachable from the website | 1 (`dh_content_app`) | 0 | 4 Dec | ISO-3 permission test |
| Admin-function blockers open | 6 | 0 | 16 Nov | `docs/quality/admin-audit-2026-10-28.md` |
| Admin-function Majors open | 11 | 0 | 11 Dec | Same |
| Website builds from Studio content that need patching first | Every build (error pages, redirects, schema formats) | 0 | 16 Nov | API-source build in CI |

## Risks and dependencies

The biggest risk is the dependency upgrades in Wave 0 changing the built site; the biggest dependency is the open owner decisions, best answered together at the start of Wave 0.

| Risk | Effect | Mitigation |
| --- | --- | --- |
| `next` 16.4.3 changes the static export | Design check, section comparison or screenshots differ; Wave 0 misses 3 Nov | Its own pull request with the `screenshots` label; the screenshot report is reviewed by hand, because that step cannot fail until Wave 1; if it slips, an owner exception with an expiry |
| Development-package updates (`vite`, `vitest`, `undici`) break builds or tests | The 3 Nov deadline is missed for those packages | Update them in the same week; any that cannot move get an owner exception with an expiry |
| The default-branch switch starts Dependabot | Up to 20 pull requests compete with the one-a-day pace | Minor and patch updates are already grouped; triage is a Wave 0 item; bot pull requests are outside the 26 |
| Branch protection and CODEOWNERS need a paid GitHub plan on a private repository | P-1 stays open; review requests stay manual | Owner decides O-9: upgrade, or record an exception |
| Making the section comparison blocking turns CI red | Every pull request fails until the careers difference is settled | Settle the careers section (O-11) in the same pull request that removes `continue-on-error` |
| New gates add noise and slow pull requests | Agents work around a gate, or it gets loosened | Seven-day report mode and a baseline for each gate; only new code must meet it; a canary fixture catches loosening |
| Editing applied migrations | Catalogs that already ran `NavigationLinkRefs` or `AddRefreshTokenSessionStart` could drift | `EXEC` wrapping changes how the SQL is compiled, not what it does; show each change first, as `AGENTS.md` requires, and test it on a copy of `DigitalHubContent_Studio` |
| OpenAPI needs a new package | Wave 3 waits on an ADR and owner approval | If declined, A-1 and A-12 stay open (45 of 54); the route list and the unknown-field and error-shape tests still land |
| The dates have no slack | A day's wait at an exit gate, or a failed check, moves every later date by a day | Answer the decisions in one round; the owner confirms each exit gate the day it is reached |
| Phase D has no date | Wave 4 cannot be scheduled | Nothing in Waves 0 to 3 depends on it |
| Sixteen owner decisions are open (O-1 to O-11, O-13 to O-17; O-12 is decided) | Every wave except Wave 2, and G2 and G3, wait on at least one | Ask them as one round of questions at the start of Wave 0, each with its recommendation, as section 3 of the standard asks |
| Two merge slots overload the one integrator and the checkers | Merges queue; dates slip | Slot 2 takes at most one a day; three agents rotate as builder and checker; if the queue passes three pull requests, slot 2 pauses for a day |
| The split (G2) breaks the public forms | Contact and apply stop working | ISO-1 moves code with no behaviour change first; the form browser tests run against the public API before the admin API drops the routes (ISO-4 after ISO-5's tests) |
| G3 fixes collide with Wave 2 lint and format baselines | Pull requests fail on files the fix touched | Baselines cover existing code only; a G3 fix meets the gate on its changed lines |

## Revision notes

Changes made on 28 October after an independent review of the 27 October draft. The draft's figures are kept here so they can be compared.

- **Target.** "Met after Wave 3" was 50 of 54, which counted P-1, P-4, B-2 and B-5 as met although no planned item enforces P-4, B-2 or B-5. It is now 47, with P-1 conditional on the GitHub plan; rules closed went from 27 to 24.
- **Security scope.** The draft counted 6 production advisories and left the development-package Highs to Wave 1, where switching on the full-tree audit would have turned Security red. All are now in Wave 0 (8 packages).
- **Wave 0 test.** "The npm audit gate reports 0 new findings" would have passed with known Highs still present, because the gate fails only on new ones. It now requires a full-tree audit of 0, or an exception for each.
- **Schedule.** Waves 1 to 3 now account for the seven-day report mode and one pull request a day: Wave 1 ends 16 Nov (blocking 23 Nov), Wave 2 runs 17–25 Nov (blocking 2 Dec), Wave 3 runs 26 Nov–7 Dec (blocking 14 Dec). The draft ended 11 Dec.
- **Register.** GAP-04 and GAP-12 no longer cite rules they do not belong to (G-2, S-4). GAP-34 (map the standard's roles) and GAP-35 (review every route's policy) were added. GAP-05 now covers the screenshot comparison, GAP-06 the second migration with the same defect, GAP-09 Node and .NET versions, GAP-13 the build log and `CLAUDE.md`.
- **Wave 0 settings.** The owner makes them; branch protection is checked on a throwaway branch, never by pushing to `rebuild/dotnet-platform`; the Dependabot pull requests the switch starts are planned for.
- **Done-when criteria.** Probes from the test run are replaced by integration tests in CI; each gate's canary is a committed fixture; the unknown-field test takes its routes from the route list.
- **Decisions.** O-9 (GitHub plan), O-10 (staging for Phase D) and O-11 (careers section) were added, and each wave lists the decisions it waits on.

**Added later on 28 October.** A review of how the Studio is isolated from the website added GAP-36 (admin routes answer only on the Studio host), GAP-37 (the exposure test proves the website's domain hides them) and GAP-38 (a separate database login for the public forms), with decision O-12, and decision O-13 (restrict the Studio subdomain to known networks) was recorded for Wave 4. GAP-36 rides in the Wave 3 route-list pull request and GAP-37 in the Wave 4 exposure test, so no date moved; GAP-38 is a new Wave 4 item. The rule counts are unchanged, since none of the three is a rule of the standard.

**Restructured later on 28 October.** The owner set three goals and chose option B for isolation ("b", 28 October 2026, in this session, reply to "A or B for the isolation."). The plan now runs as three tracks in two merge slots. G1 keeps every wave and date. G2 replaces the GAP-36 and GAP-38 approach with ADR 0001: a public-forms API with its own login, and the admin API on the Studio host only. G3 adds the 25 admin findings from a hands-on audit of the running Studio (6 blockers, 11 Majors, 8 Minors). Decisions O-14 to O-17 come from that audit. The rule counts are unchanged.
