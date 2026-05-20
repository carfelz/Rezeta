---
name: rezeta-design
description: Use this skill to generate well-branded interfaces and assets for Rezeta (a medical ERP for Dominican specialists, built around protocols, multi-location practice, and SOAP consultations), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

Key files:
- `README.md` — product context, visual foundations, content fundamentals, iconography
- `colors_and_type.css` — Rezeta tokens (colors, type, spacing, radii, shadows, semantic vars)
- `shadcn-tokens.css` — shadcn-compatible CSS variable mapping (--primary, --card, etc.)
- `ui_kits/web_app/` — 5-screen click-thru: Dashboard, Agenda, Pacientes, Consulta (SOAP), Protocolo Editor
- `preview/` — design-system specimen cards
- `source/` — original Rezeta repo files (tokens.css, components.css, reference.html, app-prototype.html, specs/)
- `assets/` — logos and brand marks

When generating Rezeta-branded work:
- Default to Spanish copy. Sentence case. "Tú" implicit through verbs.
- Use Source Serif 4 (display/headings/patient names), IBM Plex Sans (UI), IBM Plex Mono (kickers/data).
- One brand color only — deep teal #2D5760. The 2px vertical teal rule on the left edge is the signature for active/selected states.
- Phosphor Icons (regular weight) via CDN — never emoji, never custom SVG illustrations.
- Borders carry hierarchy; shadows are reserved for popovers/modals/toasts.
- Three radii only: 3 / 5 / 8 px.
- Semantic colors (success/warning/danger/info) only for clinical or admin state, never decoration.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and create static HTML files. Reference `colors_and_type.css` directly. For React work, the shadcn-flavored primitives in `ui_kits/web_app/shadcn.jsx` are the easiest starting point.

If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without other guidance, ask what they want to build, ask clarifying questions about scope and surface, then act as an expert designer who outputs HTML artifacts or production code.
