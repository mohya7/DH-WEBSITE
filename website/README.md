# Website

Next.js App Router, static export, TypeScript. Built in Phase C
(`docs/phase-c-website.md`).

## Build

```bash
cd website
npm ci
CONTENT_SOURCE=snapshot npm run build                 # from fixtures/snapshot/
CONTENT_SOURCE=api CONTENT_API_URL=http://localhost:5097 \
  CONTENT_BUILD_TOKEN=<Build:Token> npm run build       # from the Content API
```

The output is `out/`. There is no default source: with `CONTENT_SOURCE` unset,
or set to anything but `snapshot` or `api`, the build stops and says what to set.
On Windows PowerShell, set the variables with `$env:CONTENT_SOURCE = "snapshot"`.

`npm run build` runs five steps, and any of them can stop the build:

| Step | What it does |
|---|---|
| `gen:types -- --check` | Fails if `src/content/generated/schema-types.ts` is out of date with `packages/sections` or `packages/collections` |
| `prepare:content` | Reads the configured source **once**, checks it, writes `.content/` and `public/media/` |
| `prepare:design` | Copies `design/` to `public/design/<hash>/` |
| `next build` | Renders every page from `.content/` |
| `check:output` | Checks `out/`, and prints the page count and every route |

`npm run dev` runs the first three steps, then `next dev`.

## Data layer — `src/content/`

| File | Role |
|---|---|
| `config.ts` | Reads `CONTENT_SOURCE`, `CONTENT_API_URL`, and `CONTENT_BUILD_TOKEN`. No default |
| `sources.ts` | `snapshot`: `fixtures/snapshot/content.json` and `fixtures/snapshot/media/`. `api`: `GET {CONTENT_API_URL}/api/v1/build/content` with the `X-Build-Token` header, and media from `{CONTENT_API_URL}/media/` |
| `validate.ts` | Checks every section and item against its JSON Schema (Ajv, the same files the API uses), the counts, and the media |
| `routes.ts` | One route per published item with a path, at exactly the path the API resolved. Clean, unique, not reserved |
| `media.ts` | Variant file names, `srcset`, alt text, and which media published content uses |
| `prepare.ts`, `prepared.ts` | Write and read `.content/content.json` and `.content/manifest.json` |
| `site.ts` | What pages call: `getSite()` — routes, media, references, error pages |

**Why a prepare step.** Next renders pages in several worker processes. If each
one read the API, a build would make several requests to an endpoint limited to
30 an hour, and pages could come from different moments in the content. The
prepare step reads the source once. Every page is rendered from that copy.
`next build` on its own checks the configuration too, and refuses prepared
content that came from a different source or no longer matches the snapshot.

The token is sent only as a request header. It is never written to `.content/`,
to the output, or to the log.

## Types from the schemas — `npm run gen:types`

`scripts/generate-schema-types.ts` reads `packages/sections/*.json`,
`packages/sections/defs.json`, and `packages/collections/*.json`, and writes
`src/content/generated/schema-types.ts`:

- one interface per section (`HeroFields`, …) and per collection (`BlogPostsFields`, …)
- `Media`, `Reference`, `Link`, `TextPair`, and `Block` from `defs.json`
- `Section`, a union discriminated by `type`, so a section's `fields` are typed by its type
- `sectionTypes` and `collectionNames` as constants

It handles only the JSON Schema keywords the schemas use, and stops with an error
on any other, so a new construct cannot be typed wrongly by accident. Commit the
regenerated file with any schema change: the build fails while it is stale.

Types cover the code. `validate.ts` covers the data: the build fails if the
content it received does not match the same schemas.

## Routes

`src/app/[[...path]]/page.tsx` serves every page type — home, pages, services,
partners, case studies, blog posts, vacancies — through `generateStaticParams`,
with `dynamicParams = false`. `src/app/not-found.tsx` builds `404.html`, and
`src/app/500/page.tsx` builds `500.html`, from the `error-404` and `error-500`
page records.

Pages are exported as `about.html`, `services/ai-automation.html`, and so on.
Links use the clean path (`/about`). Mapping one to the other in IIS is Section 8.

## Images

Static export cannot use Next's image optimiser, and `next/image` is not
configured, so using it fails the build. `src/adapters/Image.tsx` renders `<img>`
with the stored width and height, a `srcset` from the stored variant widths
(`<hash>-w640.webp`, …), and the usage's alt text or an empty alt when
decorative. The prepare step copies the files published content uses into
`public/media/`, and Next copies them into `out/media/`.

## Design — `design/`

The stylesheets, scripts, and the assets they reference, ported from
`feature/interviewer-portal` byte for byte (Phase C, Section 3). The build copies
the folder to `/design/<hash>/`, where the hash covers every file, and each page
type loads its set from `src/design/sets.ts` with plain `<link>` and `<script>`
tags in the old order. They never go through Next's CSS pipeline.

```bash
npm run design:check                        # compare with origin/feature/interviewer-portal
npm run design:check -- --source-dir "D:\work\DigitalHub\New Website\DH-WEBSITE-main"
```

It checks every file's SHA-256 and every design set's loading order against the
old pages. The one permitted change is listed in `docs/phase-c-website.md`,
"Ported with changes". Never edit `design/` by hand.

## Tests

```bash
npm test            # Vitest
npm run typecheck   # tsc, including the compile-time checks in test/schema-types.test.ts
```

The `api` source is tested against a local HTTP server that behaves like the
build endpoint. It checks the token, returns 401 and 429, and serves media.
