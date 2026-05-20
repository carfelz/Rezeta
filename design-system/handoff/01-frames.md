# 01 · Frame Inventory

Every reachable state of the redesigned consultation, in order. Screenshots are 1440×900.

> **Convention.** "Strip" = the protocol context band under the consultation header.
> "Gate" = the pre-consultation motivo screen.
> "Vista" = the SOAP ↔ Canvas mode toggle.

---

## Main flow — `frames/01-hybrid.png` … `07-hybrid.png`

### 01 · Start Gate (entry point)

`frames/01-hybrid.png`

- Route: `/consulta/nueva?patientId=…` (existing `ConsultaNueva` page, redesigned).
- Header: patient identity, "Paso 1 de 2 · ¿Qué traes hoy?" overline, H2 "Comencemos con el motivo".
- Three "Para Isabel" cards: ranked by patient history. Top card is highlighted with the 2px teal left rule and "Más probable" badge.
- Search input ("Buscar entre tus 34 protocolos…") + 6 specialty buckets.
- "Continuar sin protocolo" escape hatch in dashed card at bottom.
- Top-right: "Saltar y abrir consulta vacía" link (same destination as escape hatch — duplicate is intentional, doctors will look in both places).

**Click targets:** any motivo card → creates Consultation + ProtocolUsage, navigates to consultation route. Search → filter same grid in place. Skip → creates Consultation with no usage, navigates.

### 02 · Gate hover state

`frames/02-hybrid.png`

- Same screen with hover on "Seguimiento HTA" card. Lift + bg fill + "Abrir consulta con este protocolo →" affordance line. Demonstrates the click target is the whole card.

### 03 · Consultation opens — pre-armed

`frames/03-hybrid.png`

- Default Vista: SOAP. Looks like today's consultation BUT:
  - Protocol strip is full-width under header, not buried in the right rail.
  - Strip shows: protocol name + version chip, progress bar (2/8), "Vista: SOAP|Canvas" segmented control, "Ver pasos", "Cambiar".
  - Motivo and Vitales cards already filled (the gate's selection populated them).
  - SOAP cards for Subjetivo/Examen/Evaluación/Plan are empty placeholders.
  - Right rail: Alertas, Pasos del protocolo (8-step list with current step highlighted), Órdenes counter.
- The Vista toggle is the *only* new control versus today's consultation page — everything else is rearrangement.

### 04 · Anamnesis + examen filled

`frames/04-hybrid.png`

- Same screen, doctor has filled Subjetivo and Examen físico (both auto-tagged "Anamnesis dirigida del protocolo" / "Lista del protocolo · 4 hallazgos").
- Strip progress: 4/8.
- Right-rail step list: 1–4 ✓.

### 05 · Decision step active

`frames/05-hybrid.png`

- Evaluación card now contains the protocol decision branch UI inline: question banner ("¿Alcanza meta PA <130/80?"), two branch options as side-by-side cards, one selected (2px teal border + "Elegir" badge).
- Right-rail step list: step 5 shows "en curso".
- "Aplicar rama y continuar" button below the branches with `↵` keyboard hint.

### 06 · Ready to sign

`frames/06-hybrid.png`

- All SOAP cards filled. Plan card shows the auto-summary plus a success chip "Receta generada · 2 fármacos · seguimiento agendado 30 may".
- Right-rail step list: 8/8.
- Header right slot: "Protocolo completo ✓", "Vista previa", "Firmar y cerrar" (primary).

### 07 · Vista = Canvas

`frames/07-hybrid.png`

- Same data, Canvas mode. The 8 protocol steps are the spine; each step's content (vitals grid, anamnesis text, examen checklist, decision branches, dosing table, education checklist, follow-up date) renders inline.
- SOAP collapses to a small "Resultado SOAP" panel in the right rail — the doctor confirms it, doesn't author it directly.
- Toggle persists: setting `consultation_view_mode` on the user (or local preference; see open question Q3).

---

## Edge cases — `frames/01-edge.png` … `08-edge.png`

### 01 · Skip step

`frames/01-edge.png`

- Modal: "Omitir paso 4 · Examen físico". Reason picker (Aplica solo si hay hallazgos / Paciente lo rehúsa / No relevante hoy / Otro) + free-text. Confirm or Cancel.
- After confirm: step renders in the strip & right-rail list with a strike-through and "Omitido · razón" tooltip. Counts toward "completed" for progress.

### 02 · Off-protocol note

`frames/02-edge.png`

- Inside the consultation body, between SOAP cards, doctor pasted an unstructured note. Card has dashed border + "Fuera de protocolo" overline.
- Two affordances: "Convertir en paso" (escalates to template editor as a suggestion) and "Mover a Subjetivo" (folds it into the relevant SOAP field).

### 03 · Switch protocol mid-consultation

`frames/03-edge.png`

- Dialog opened from strip's "Cambiar" button. Three columns:
  - **Se conserva** — Motivo, vitales, Subjetivo (because they're step-agnostic).
  - **Se mueve a notas** — anything authored under steps from the old protocol that doesn't have a matching step in the new one.
  - **Se descarta** — nothing, by default. Confirm-by-typing for safety.
- New `ProtocolUsage` row, old one marked `status=switched`.

### 04 · Multi-protocol (two usages on one consultation)

`frames/04-edge.png`

- Strip shows two pills: "HTA — Seguimiento" + "DM2 — Control". One is "activo"; clicking the other switches the strip context. Vitals & Motivo are shared (single source). Steps are interleaved in the right rail with origin tags.
- This is a rare path — gate at start covers ~95% — but it must round-trip cleanly.

### 05 · Conditional step

`frames/05-edge.png`

- PA entered as 168/102. A new step "4b · Crisis hipertensiva — evaluación" appears in the strip and right-rail list with an animated badge "Condicional · activado por PA ≥160". Step content is rendered inline in the body.
- Conditions are declared by the protocol template; this UI only renders them appearing/disappearing.

### 06 · Validation — required fields missing

`frames/06-edge.png`

- Doctor pressed "Firmar y cerrar". Inline panel slides in: "Faltan 2 campos requeridos por protocolo". List shows: Examen · Auscultación pulmonar (required); Plan · Educación adherencia (required). Each row has a "Ir →" link that scrolls + focuses.
- Sign button is disabled until empty.

### 07 · Resume interrupted consultation

`frames/07-edge.png`

- Doctor opens an in-progress consultation from another tab/device. Welcome-back screen: patient name, "Continuar consulta de hace 23 minutos", progress bar, list of completed steps. "Continuar" (primary) + "Ver resumen".

### 08 · No protocols configured

`frames/08-edge.png`

- Clinic-level empty state inside the gate. "Aún no tienes protocolos en tu biblioteca." CTA: "Crear el primero" (link to Protocol Editor) and "Continuar sin protocolo" (proceeds to blank consultation).
