# API

ASP.NET Core Web API on .NET 10. Solution: `DigitalHub.slnx`. Project: `src/DigitalHub.Api`.

Connection string, token signing key, and the initial admin email and password are user-secrets (`ConnectionStrings:Content`, `Auth:SigningKey`, `Auth:InitialAdminEmail`, `Auth:InitialAdminPassword`). They are not in this repository. The API refuses to start when the admin password is missing. The connection string still uses Windows authentication until Section 5 replaces it with a restricted SQL login. Once `DigitalHubContent` exists, these integration tests should run against a real SQL Server test database. Concurrency, unique indexes, and transactions are not the same on the SQLite provider the tests use now.

Tests: `dotnet test api/tests/DigitalHub.Api.Tests -c Release` from the repository root, or from `api/`.
