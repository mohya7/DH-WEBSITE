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
