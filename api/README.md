# API

ASP.NET Core Web API on .NET 10. Solution: `DigitalHub.slnx`. Project: `src/DigitalHub.Api`. Library: `src/DigitalHub.Forms`, the contact and apply code (validation, intake, throttles, dedupe, email), which the API and the tests reference (ADR 0001). Public forms API: `src/DigitalHub.PublicApi` (ADR 0001), its own process, reached only at `POST /api/v1/public/contact` and `POST /api/v1/public/apply`; every other path returns 404. Its connection key is `ConnectionStrings:PublicForms`, and it refuses to start with any `Auth` setting.

Connection string, token signing key, and the initial admin email and password are user-secrets (`ConnectionStrings:Content`, `Auth:SigningKey`, `Auth:InitialAdminEmail`, `Auth:InitialAdminPassword`). They are not in this repository. The API refuses to start when the admin password is missing. `ConnectionStrings:Content` uses the restricted SQL login `dh_content_app` against `DigitalHubContent`. That login can read and write rows. It cannot change the schema. Integration tests use the same login against `DigitalHubContent_Test`. The application does not apply migrations at startup.

Tests: `dotnet test api/tests/DigitalHub.Api.Tests -c Release` and `dotnet test api/tests/DigitalHub.PublicApi.Tests -c Release` from the repository root, or from `api/`.
