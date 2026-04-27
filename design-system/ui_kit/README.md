# Rezeta Web App · UI Kit

A pixel-faithful, click-through recreation of the Rezeta MVP. Built on a Rezeta-flavored shadcn/ui primitive layer.

## Files

| File | What's in it |
|---|---|
| `index.html` | Mount point — loads tokens, fonts, Tailwind CDN, Phosphor, then the four JSX modules |
| `shadcn.jsx` | shadcn-flavored primitives: Button, Input, Card, Dialog, Tabs, Badge, Switch, Checkbox, Select, Tooltip, Table, DropdownMenu, Toaster + toast(), Calendar, Command, Separator, Textarea |
| `rezeta-components.jsx` | Rezeta-specific surfaces: `Sidebar` (with 2px teal active rule), `TopBar`, `PBlock` / `PListItem` (the protocol-block), `PageHead`, `Callout` |
| `screens.jsx` | Five core screens: `DashboardScreen`, `PacientesScreen`, `ConsultaScreen` (SOAP), `ProtocoloEditorScreen`, `AgendaScreen` |
| `app.jsx` | Mount + routing — switches the screen based on sidebar nav |

## Screens

1. **Dashboard** — Today's agenda, KPI cards, drafts, revision warnings
2. **Pacientes** — Filterable patient list with tabs (Todos / Activos / En seguimiento / Archivados), location filter, density-tight table
3. **Consulta (SOAP)** — Live editor for a patient consultation: S/O/A/P blocks, vital signs grid, prescription panel, "Firmar y publicar" dialog with toast confirmation
4. **Protocolo Editor** — The signature surface: protocol blocks with 2px teal rule, mono type tags ("checklist" / "alerta · crítica" / "tabla · dosis"), nested decision branches
5. **Agenda** — Week view, multi-location, today highlighted

Click any patient row → opens the Consulta screen for Ana María Reyes.
The "Firmar y publicar" button on Consulta opens a confirm dialog and emits a toast on confirm.

## How to extend

- Surfaces map cleanly to shadcn — if you need a new primitive, follow the patterns in `shadcn.jsx`.
- New screens go in `screens.jsx`. Wire them in `app.jsx`'s `switch(route)`.
- Add a sidebar entry in `RZ_NAV` inside `rezeta-components.jsx`.
