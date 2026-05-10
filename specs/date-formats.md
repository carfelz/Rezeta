# Date format conventions

> Living document. Last updated: 2026-05-10.
>
> Source of truth for how dates and times are presented across the app.
> Centralizes what was previously inline ad-hoc formatting (Agenda, ConsultaNueva, patient detail, etc.) into one helper module.

The four canonical formats below cover every user-facing surface. Implementation lives in `apps/web/src/lib/format/dates.ts`.

| Name                | Helper                                           | Example                                                        | Used in                                       |
| ------------------- | ------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------- |
| Long lowercase      | `formatDateLong(date)`                           | `jueves, 7 de mayo de 2026`                                    | Page titles, modal headers, agenda day header |
| Long uppercase mono | `formatConsultationOverline(date, locationName)` | `JUEVES, 7 DE MAYO DE 2026 · 02:40 A.M. · CONSULTORIO PRIVADO` | Consultation overline only                    |
| Short               | `formatBreadcrumbDate(date)`                     | `7 may de 2026`                                                | Breadcrumbs, table rows, badges               |
| Numeric             | `formatDateNumeric(date)`                        | `07/05/2026`                                                   | Exports, prescription printouts               |

## Rules

1. Spanish convention is **lowercase weekday + month + connectors** (e.g. `de`). Title casing the connector ("De") is grammatically wrong.
2. The Long uppercase mono format is the **only** surface that uppercases the connector. It exists for the consultation header overline and nowhere else.
3. The agenda day header capitalises only the first letter ("Jueves, 7 de mayo de 2026"). Implementation: call `formatDateLong` then upper-case the first letter — never use Tailwind `capitalize`, which would also upper-case `de` and `mayo`.
4. Time strings use 12-hour AM/PM with no leading zero on the hour (`9:30 AM`, not `09:30`).
5. Numeric dates use leading zeros (`07/05/2026`).

## Replacing inline formatters

Any file that calls `Date.prototype.toLocaleDateString` or hand-rolls a date string is a target for migration. Replace with the appropriate helper from `apps/web/src/lib/format/dates.ts`. Tests for the helpers live in `apps/web/src/lib/format/__tests__/dates.test.ts`.

## English (future)

When the English toggle ships, mirror these helpers under `apps/web/src/lib/format/dates.en.ts` and route through a locale switch. The four canonical names stay; only the localized strings change.
