# Studio

Vite + React Content Studio (Ant Design, Tailwind). Built in Phase B.

Access tokens stay in memory. Do not store them in `localStorage`, `sessionStorage`, or any other durable browser store. The refresh token is an `HttpOnly` cookie. The CSRF token is a second cookie, `dh_csrf`, readable by JavaScript, `SameSite=Strict`, path `/api/v1/auth`. After a reload, read that cookie and send it as the `X-CSRF-Token` header on refresh and logout. The header must match the cookie.
