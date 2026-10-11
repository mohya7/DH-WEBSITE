# Studio

Vite + React Content Studio (Ant Design, Tailwind, React Router, TanStack Query).

## Auth

Access tokens stay in memory, in a module variable. Do not store them in `localStorage`, `sessionStorage`, or any other durable browser store.

The refresh token is an `HttpOnly` cookie, `dh_refresh`, `Secure`, `SameSite=Strict`, path `/api/v1/auth`. The CSRF token is a second cookie, `dh_csrf`, readable by JavaScript, `Secure`, `SameSite=Strict`, path `/`. A cookie limited to `/api/v1/auth` is not visible to `document.cookie` on the Studio page, so the CSRF cookie uses the site root. After a reload, read `dh_csrf` and send it as the `X-CSRF-Token` header on refresh and logout. The header must match the cookie.

A second tab restores the same session by calling refresh. Refresh rotates the cookie, so tabs take a Web Lock (`dh-studio-refresh`) and read the cookie again inside it. Sign-out is announced to other tabs with a `BroadcastChannel`. That message carries no token.

## Development

The dev server is `http://127.0.0.1:5173`. Vite proxies `/api` and `/media` to `http://127.0.0.1:5088`, so the Studio and the API share an origin and the auth cookies work unchanged.

Start the API with `ASPNETCORE_ENVIRONMENT=Development` so user secrets load, then `npm run dev` in this folder.

## Theme

Ant Design seed tokens: `colorPrimary` `#1270A0`, `fontFamily` Poppins. Ant Design has no accent seed token. The accent `#F4970B` is the CSS variable `--dh-accent`, used for the Studio mark.

## Tailwind

Tailwind 4.3. Preflight is not imported. `src/index.css` loads `tailwindcss/theme.css` and `tailwindcss/utilities.css` only, so Tailwind utilities are available and Ant Design's own reset keeps component styles.

## Website address

`VITE_PUBLIC_SITE_URL` is the public website's address for this environment: production, staging, or a local website server. It is required and has no default. `npm run dev` and `npm run build` refuse to start without a valid absolute `http(s)` URL (no credentials, query, or fragment), and the app refuses to load without one. "View site", each published item's Preview link, and links inside the draft preview point to it.

Set it in `studio/.env.local` (not committed; see `.env.example`) or in the build's environment. The end-to-end harness sets it for its own dev server (`DH_E2E_SITE_URL`, default `http://127.0.0.1:8765`); no website needs to run, because the tests compare links with it and never follow them.

## Draft preview

"Preview draft" in the item editor shows the item's sections as the website renders them: the section components from `packages/blocks`, with the website's own stylesheets for that page type (`website/src/design/sets.ts`), inside an iframe. It previews what is on screen, saved or not. The iframe gets its document as `srcdoc` and is sandboxed without scripts, so the website's styles never reach the Studio and the Studio's never reach the preview. Because no script runs, elements the website reveals by script (`[data-reveal]` and friends) are rendered in their revealed state. Lists and references use published items only, as on the website: a published item with unpublished edits shows its latest revision.

The stylesheets are not copied into the Studio's source. `vite/websiteDesign.ts` serves `website/design/` byte for byte at `/website-design/<hash>/` in development and emits it into `dist/` at build, under the website's own content hash. The build then compares the emitted files with `website/design/` and fails on any difference. `npm run check:preview-design` runs that check on an existing `dist/`.

## Tests

- `npm test`: unit tests (Vitest): the website address rules and the preview's design-file check.
- `npm run test:e2e`: the end-to-end suite against `DigitalHubContent_E2e`. Ports default to 5099 (API) and 5174 (Studio); set `DH_E2E_API_PORT` and `DH_E2E_STUDIO_PORT` to use another range.
