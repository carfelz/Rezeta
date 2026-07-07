# Patient Antecedentes Input + Inline Patient Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Let doctors enter allergies and chronic conditions in the patient create/edit forms (backend already supports them; UI fields are missing everywhere). (2) Add a "Nuevo paciente" last option to the patient picker used when booking, opening the patient-creation modal and auto-selecting the created patient.

**Architecture:** A small reusable tag-input component (chips with add/remove) drops into `PatientModal` (create mode) and `EditModal`. `PatientCombobox` gains a fixed last option "Nuevo paciente" that opens the existing patient-creation modal (reused or minimally extracted); on successful create it calls the combobox's `onChange(patientId, patientName)` so the booking flow continues seamlessly.

**Investigated facts (verified, build on these):**
- `CreatePatientSchema`/`UpdatePatientSchema` (packages/shared/src/schemas/patient.ts:17-18) already accept `allergies: string[]` and `chronicConditions: string[]`; API persists both. NO backend changes needed.
- `PatientModal` (apps/web/src/pages/Patients/PatientModal.tsx) — create/view modes; create form fields: fullName, dateOfBirth, sex, documentType, documentNumber, phone, email, notes; payload hardcodes `allergies: patient?.allergies ?? []`.
- `EditModal` (apps/web/src/pages/PatientDetail/EditModal.tsx) — same field set; payload passes `patient.allergies` through unchanged.
- `PatientCombobox` (apps/web/src/pages/Schedule/PatientCombobox.tsx) — searchable list over `usePatients({ search })`, `onChange(patientId, patientName)`, no create affordance. Used by AppointmentFormModal (apps/web/src/pages/Schedule/AppointmentFormModal.tsx:195-201).
- Display components stay as-is: MedicalInfoBlock (patient page card), consultation PageHeader badges.

## Global Constraints

- Token classes only; Spanish strings colocated in each page's strings.ts; 2-space indent; no TODO/FIXME; lower-case commit subjects.
- Check `specs/design-system/components.md` and `apps/web/src/components/ui/` for an existing tag/chip input BEFORE creating one; only create `TagInput` if nothing fits, and put it in `apps/web/src/components/ui/` with a story if the ui-kit has Storybook stories for peers.
- Gates per task: `pnpm --filter @rezeta/web test`, `pnpm lint`, `pnpm -r typecheck`. Final task adds `pnpm test` + `pnpm test:coverage` (95% per-file; src/pages/** exempt, components/ui NOT exempt).
- Accessibility: the tag input must be keyboard-operable (Enter adds, Backspace on empty input removes last, per-chip remove buttons with aria-labels).

---

### Task 1: TagInput component + antecedentes fields in both patient forms

**Files:**
- Create: `apps/web/src/components/ui/TagInput.tsx` (+ export from `apps/web/src/components/ui/index.ts`; + `TagInput.stories.tsx` if peers have stories)
- Test: `apps/web/src/components/ui/__tests__/TagInput.test.tsx` (mirror neighbors' harness)
- Modify: `apps/web/src/pages/Patients/PatientModal.tsx` (create mode gains Alergias + Condiciones crónicas fields; payload uses the state instead of the hardcoded passthrough)
- Modify: `apps/web/src/pages/PatientDetail/EditModal.tsx` (same two fields, seeded from `patient.allergies`/`patient.chronicConditions`; payload uses edited state)
- Modify: the two pages' strings.ts files (labels/placeholder/add aria-label, Spanish — e.g. `alergiasLabel: 'Alergias'`, `condicionesLabel: 'Condiciones crónicas'`, `tagInputPlaceholder: 'Escribir y presionar Enter…'`, `tagRemoveAria: (tag) => \`Quitar ${tag}\``)
- Extend existing tests: PatientModal + EditModal test files (create with allergies → payload contains them; edit adds/removes a chronic condition → payload reflects it)

**Interfaces:**
- Produces:

```tsx
export interface TagInputProps {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  removeAriaLabel?: (tag: string) => string
  id?: string
  disabled?: boolean
}
export function TagInput(props: TagInputProps): JSX.Element
// Behavior: text input; Enter or comma commits the trimmed value (ignores empty/duplicate,
// case-insensitive dedup); Backspace on empty input removes the last tag; each chip renders
// with a remove button. Chips use Badge-like token styling (bg-n-50 border-n-200 text-n-700
// rounded-sm), NOT semantic alert colors — semantic coloring belongs to display contexts.
```

- Steps: TDD — failing TagInput tests (add via Enter, add via comma, trim, dedup case-insensitive, Backspace-on-empty removes last, remove button, disabled state) → implement → wire into both modals (side-by-side Field pair matching each modal's existing layout rhythm) → extend modal tests → gates → commit `feat(web): allergies and chronic conditions input in patient forms`.
- EditModal note: seed local state from the patient prop once (useState initializer); payload sends the edited arrays.
- PatientModal note: fields appear in CREATE mode; view mode already renders read-only badges — leave view mode untouched.

---

### Task 2: "Nuevo paciente" option in PatientCombobox + booking wiring

**Files:**
- Modify: `apps/web/src/pages/Schedule/PatientCombobox.tsx`
- Modify: `apps/web/src/pages/Schedule/strings.ts` (`comboboxNewPatient: 'Nuevo paciente'` etc.)
- Modify (only if needed for reuse): `apps/web/src/pages/Patients/PatientModal.tsx` — reuse it in create mode from the combobox. READ IT FIRST: if it's cleanly importable (props: mode, onClose, onCreated?) reuse directly; if it's coupled to the patients page (e.g. navigation on success), add an optional `onCreated?: (patient: Patient) => void` prop that suppresses the page-coupled behavior — do NOT fork a second create form.
- Test: extend PatientCombobox tests (or create the file mirroring Schedule test harness) + AppointmentFormModal test for the end-to-end select-after-create.

**Interfaces:**
- Behavior contract:
  - The dropdown list always renders a fixed LAST option "Nuevo paciente" (with a `ph-plus` icon, separated by a top border `border-t border-n-100`), visible regardless of search results — including the empty-results state.
  - Selecting it opens the patient-creation modal (with the Task-1 antecedentes fields included, since it reuses the same form).
  - On successful creation: modal closes, `onChange(newPatient.id, fullName)` fires, combobox shows the new patient as selected, patients query cache invalidated (the create hook already does this — verify).
  - Cancel/close returns to the combobox unchanged.
- Tests: last option renders with results AND with zero results; clicking it opens the modal; simulated successful create calls onChange with the new id and closes the modal; cancel leaves selection unchanged.
- Commit: `feat(web): create patient inline from booking patient picker`

---

### Task 3: Changelog + gates

- CHANGELOG.md entry `## [2026-07-07] Antecedentes del paciente y alta desde agenda`: Added — TagInput; Alergias/Condiciones crónicas en crear/editar paciente; opción «Nuevo paciente» en el selector de la agenda con alta inline y selección automática.
- `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:coverage` all green (re-run flaky web timeouts in isolation once).
- Commit `docs: changelog for patient antecedentes and inline creation`.
