# Shared blocks

The section components — one per section type in `packages/sections`, all 28 —
and the rich-text renderer. Used by the Next.js website, and later by the Studio
preview. Phase C, Section 4 (`docs/phase-c-website.md`).

## Rules

- **Same markup as the old site.** Each component renders the markup the old
  page shows after its runtime (`content-runtime.js`) filled it in: the same
  elements, classes, ids, attributes, and nesting, so the ported stylesheets and
  scripts apply unchanged. Where the old runtime built a list from its
  collections (home services, partners, cases, blogs, news, team, vacancies),
  the component builds it from `ctx.collections` the same way.
- **Nothing Next-specific.** No `next/*` import; only React and files in this
  package. Images go through `ctx.Image`, links through `ctx.Link`, which each
  application supplies. The website's link adapter renders a plain `<a>`.
- **Server-rendered only.** No state or effect hooks, no `"use client"`.
  `website/test/design.test.ts` checks this package too.
- **No HTML strings.** Rich text is TipTap JSON rendered as React elements;
  nothing uses `dangerouslySetInnerHTML`.
- **References render only when resolved** (`ctx.resolve` returns a path).
  Listing sections with nothing to list render nothing; `sectionRenders` says
  which, from the same selectors the components use (`src/select.ts`).

## Layout

| Path | What |
|---|---|
| `src/Section.tsx` | `<Section section ctx>`: the component for each type. The map is typed over every `SectionType`, so a type without a component does not compile |
| `src/context.ts` | `BlockContext`: `page` (kind, slug), `Image`, `Link`, `resolve`, `collections`, and `slots.hero` (the home hero's script slot) |
| `src/select.ts` | What listing sections list, and `sectionRenders`. No JSX, so build scripts use it without React |
| `src/sections/` | The components. Each file's header says which old markup it reproduces and on which pages |
| `src/richtext/` | `parseRichText`, `RichText`, and `headingAnchors` (table-of-contents ids, unique per article) |
| `src/generated/schema-types.ts` | Generated from the schemas by `npm run gen:types` in `website/`. Never edit |

## Page-dependent forms

Some section types look different on different pages of the old site; the
component chooses by `ctx.page`:

| Type | Forms |
|---|---|
| `hero` | home, about, partner, case study |
| `call_to_action` | partner pages and the partners hub; other hubs; case studies |
| `case_cards` | home (first four published), cases hub (all, with filters), service pages (the section's own items) |
| `blog_list` | home (carousel of the first five), blogs hub (all, with filters) |
| `news_carousel` | home (first eight), news hub |
| `partner_grid` | home (first six, flip cards), partners hub |
| `service_cards` | home (scrolling track), about (constellation) |
| `stats`, `logo_bar` | home, about |
| `problem` | service pages (pipeline diagram), case studies (prose) |
| `related_items` | partner pages (partner cards), case studies (links) |

Decorations the old pages hard-coded per position, service, or partner (icons,
colour modifiers, the Nexthink kicker colour, logo size tweaks) are constants in
the components, keyed by position, the service's `visual`, or the partner's slug.

`faq` has no page on the old site; it uses the old blog-post FAQ markup
(`.blog-view-faq`).
