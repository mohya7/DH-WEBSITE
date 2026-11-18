# Project profile

The one page `ENGINEERING_STANDARDS.md` is applied through. The standard is the
same in every project; this page is what is specific to this one. Keep it
current. Items marked **Owner decision** are open; they are listed with a
recommendation in `ENGINEERING_STANDARDS.md`, section 9.

| Field | Value |
|---|---|
| Product | Digital Hub public website and Content Studio, rebuilt on .NET 10 and React (`docs/business-analysis.md`) |
| Owner | Mohamed Elbadry |
| Stack | Content API: .NET 10, ASP.NET Core controllers, EF Core, SQL Server. Website: Next.js App Router, static export. Studio: Vite, React, Ant Design. Shared packages in `packages/`. |
| Hosting | IIS on Windows Server, on AWS, run by the dev team (`docs/security-deployment.md`). The website on its own domain; the Studio and its API on one origin on their own subdomain. |
| Integration branch | `rebuild/dotnet-platform`. Every change reaches it through a pull request merged by the integrator (`AGENTS.md`). |
| Deploy branch and environments | None yet. Nothing is deployed until Phase D. **Owner decision:** which branch deploys, and whether there is a staging environment. |
| Default branch on GitHub | `main`, the frozen legacy Node site. Its content is never changed (`AGENTS.md`); which branch is the default is a separate setting. **Owner decision:** make `rebuild/dotnet-platform` the default (see baseline finding F2). |
| Data held | Studio users: email, name, password hash, sessions. Contact enquiries: name, organisation, role, email, situation, message. Careers: a per-vacancy daily count only; the CV is emailed and nothing about the applicant is stored. Audit log of content changes. |
| Compliance | Personal data of people in Egypt and elsewhere. **Owner decision:** confirm which law applies (for example Egypt's Personal Data Protection Law, No. 151 of 2020) and the retention period for contact enquiries. |
| Roles | `admin` (users, settings, everything editors do), `editor` (content and media), `hr` (application counts, end a vacancy, own password). No role: cannot sign in to the Studio. Public visitors: website, contact and apply forms only. |
| Modules and special rules | Website design is locked to `feature/interviewer-portal` and verified by the design check and screenshot parity. The Studio follows the old admin panel's look. Migrations are shown before they are applied and never run at startup. Test databases are fixed: `DigitalHubContent_Test`, `DigitalHubContent_E2e`, never `DigitalHubContent`. |
| Gate thresholds | The standard's defaults. Stricter here: the audit log is append-only for the application login (`AuditLogPermissionTests`); every `api/v1` route is in the role matrix. |
| Local constraints | Windows Application Control blocks Debug test builds and fresh .NET binaries on the development machines, so .NET verification runs in CI, in Release. |
