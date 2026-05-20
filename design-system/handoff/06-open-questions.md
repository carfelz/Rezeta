# 06 · Open Questions

Where I assumed something. Please answer Q1–Q5 before slice 1 starts.

---

### Q1 · "Skip" on a required step — block or warn?

The current design lets any step be skipped with a reason. If the protocol marks a step `required: true`, do we:
(a) Allow skip + record reason (current mock behaviour), or
(b) Block skip and force completion?

I assumed (a). If (b), `SkipStepDialog` needs a "this step is required" branch.

### Q2 · "Cambiar protocolo" mid-consultation — what carries over?

I assumed:
- **Kept:** Motivo, Vitals, Subjetivo (step-agnostic).
- **Moved to notes:** anything authored under old-protocol steps with no matching step in the new one.
- **Discarded:** nothing by default.

Confirm — especially: do we preserve auto-filled Examen/Evaluación/Plan, or move them to notes?

### Q3 · View-mode persistence: per-doctor or per-consultation?

I assumed per-doctor (stored on `User.preferences`). Alternative: per-consultation (stored on `Consultation`). Per-consultation lets a doctor leave a complex visit in Canvas while keeping routine ones in SOAP, but doubles the toggle's cognitive load.

### Q4 · "Off-protocol note" → "Convertir en paso" — does it go to the protocol *template* or this *usage*?

Mock implies template (creates a `ProtocolSuggestion`). Alternative: only adds a custom step to this usage's working copy, doctor explicitly promotes later from the suggestions inbox.

I'd recommend the latter — less surprising, preserves the learning system's role. Confirm.

### Q5 · `ProtocolUsage.status='switched'` — is this audit only, or does it affect anything downstream?

I assumed audit only — switched usages still count for analytics (so utilization isn't artificially deflated by mid-visit switches). Confirm there's no order/prescription cleanup needed when an old usage transitions to `switched`.

---

### Q6 · Conditional steps — UX of removal

If a conditional step appeared (because PA was 168/102) and the doctor authored content into it, then PA was corrected to 138/88 (e.g. recheck), does the step:
(a) Stay (doctor's content shouldn't be lost), or
(b) Disappear (rule consistency)?

I'd assume (a) with a small badge "Trigger ya no aplica · mantener?". Acceptable?

### Q7 · Gate "Para Isabel" cards — what counts as a "match"?

For "matches_diagnosis", do we match on:
- Patient's active diagnoses' free-text strings against protocol title/tags? (cheap, fuzzy)
- A new explicit `Protocol.matches_diagnoses: string[]` field? (clean, requires editor work)

I'd start with the first to avoid blocking on protocol editor changes. Worth promoting later.

### Q8 · Empty-state CTA on the gate

When the clinic has zero protocols, the gate shows "Crear el primero" linking to the Protocol Editor. After creating one, does the doctor return to the gate with that patient's context preserved? My assumption: yes — the editor route should accept `?returnTo=…`.

### Q9 · Multi-protocol vitals

If two usages each declare a "Vitales" step, the body shows ONE vitals card (deduped by step type). Confirm — or do we show both?

### Q10 · Order queue placement in Canvas mode

Mocks show it as a drawer. Alternative: keep as a small fixed widget in the corner. The drawer feels right when there are 5+ orders; the widget feels lighter for routine visits. I went with drawer; flag if you'd prefer the widget for v1 and drawer later.
