# 8.1a Navigation `{ type, id }`

Migration: `api/src/DigitalHub.Api/Data/Migrations/20260922142757_NavigationLinkRefs.cs`

Applied with the elevated account to `DigitalHubContent` and `DigitalHubContent_Test`. `DigitalHubContent` has 29 navigation rows, 0 invalid, and `ck_navigation_items_link_shape`. `Down` does not restore the six deleted rows; those values live in site settings.

## Shape

| `link_kind` | Stored |
|---|---|
| `group` | label only. `url`, `target_type`, and `target_id` are null |
| `internal` | `target_type` + `target_id`. `url` is null |
| `external` | `url` only. Allowed for a later editor-entered link. The import does not write one |

`target_type` is `page`, `service`, `partner`, `case_study`, `blog_post`, or `vacancy`.

## Conversion of the 35 imported rows

| Action | Count |
|---|---:|
| Delete — email, phone, LinkedIn, Facebook, Instagram, TikTok (same values as site settings) | 6 |
| Group | 5 |
| Internal page | 11 |
| Internal service | 8 |
| Internal partner | 5 |
| Unresolved | 0 |

29 rows remain. `Down` rebuilds `url` from the target's current path (`/` for home, `/careers/apply` for apply, `/services/{slug}`, `/partners/{slug}`, and the same for pages, cases, blogs, and vacancies). It does not put the six deleted rows back.

## Fresh import

`DigitalHubNavImport`: all migrations, then the importer, no conversion step. Result: 29 navigation rows, 0 invalid, 0 settings duplicates. `digitalhub.com.eg` is an internal link to the home page. The throwaway database was dropped after the check.
