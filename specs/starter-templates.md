# Starter Templates — Protocol Engine

> Living document. Last updated: April 2026.
>
> This document specifies the pre-built protocol templates that ship with MVP. These seed the `ProtocolTemplate` table with `is_system: true` on first launch and give doctors immediate value without needing to design templates from scratch.

## Table of Contents

1. [Selection Rationale](#1-selection-rationale)
2. [Coverage Matrix](#2-coverage-matrix)
3. [Template 1 — Emergency Intervention](#3-template-1--emergency-intervention)
4. [Template 2 — Clinical Procedure](#4-template-2--clinical-procedure)
5. [Template 3 — Pharmacological Reference](#5-template-3--pharmacological-reference)
6. [Template 4 — Diagnostic Algorithm](#6-template-4--diagnostic-algorithm)
7. [Template 5 — Physiotherapy Session](#7-template-5--physiotherapy-session)
8. [Seeding Strategy](#8-seeding-strategy)
9. [Localization](#9-localization)

---

## 1. Selection Rationale

Five starter templates were chosen to balance three goals:

1. **Cover every block type** — each of the 6 block types (text, checklist, steps, decision, dosage_table, alert) appears in at least two templates, so doctors see real examples of every primitive
2. **Span the main clinical archetypes** — emergency, procedure, pharmacology, diagnosis, rehabilitation
3. **Match likely MVP specialties** — templates are specialty-agnostic but obviously useful to the specialties we expect to lead with (emergency medicine, pediatrics, physiotherapy, cardiology, general practice)

Five is a deliberate choice: enough variety to feel like a real starting library, few enough that a new user can scan them in 30 seconds.

## 2. Coverage Matrix

Which block types each template showcases:

| Template | text | checklist | steps | decision | dosage_table | alert |
|----------|:----:|:---------:|:-----:|:--------:|:------------:|:-----:|
| Emergency Intervention | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clinical Procedure | ✅ | ✅ | ✅ | — | — | ✅ |
| Pharmacological Reference | ✅ | — | — | ✅ | ✅ | ✅ |
| Diagnostic Algorithm | ✅ | ✅ | — | ✅ | — | — |
| Physiotherapy Session | ✅ | ✅ | ✅ | ✅ | — | — |

Every block type appears in at least 2 templates. Every template uses at least 3 block types.

---

## 3. Template 1 — Emergency Intervention

**Intended use:** Acute, time-sensitive interventions (anaphylaxis, stroke, cardiac arrest, hemorrhagic shock, severe asthma attack, etc.).

**Why it's a starter:** This is the most comprehensive template and the one that best showcases the engine. Emergency protocols drive the "protocol as reference you can't remember by heart" value proposition most clearly.

**Template creator's required-block decisions:**
- **Indications** (required) — you can't have an emergency protocol without criteria for activation
- **Initial Assessment** (required) — safety-critical first step
- **Intervention** (required) — the "what to do" section
- **Medications table inside Intervention** (required) — most ER protocols have meds
- Everything else optional

### JSON Schema

```json
{
  "version": "1.0",
  "metadata": {
    "suggested_specialty": "emergency_medicine",
    "intended_use": "Time-sensitive acute interventions"
  },
  "blocks": [
    {
      "id": "sec_indications",
      "type": "section",
      "title": "Indications",
      "required": true,
      "description": "When to activate this protocol",
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Clinical criteria that trigger this protocol (signs, symptoms, thresholds)." }
      ]
    },
    {
      "id": "sec_contraindications",
      "type": "section",
      "title": "Contraindications",
      "required": false,
      "description": "When NOT to use this protocol",
      "placeholder_blocks": [
        { "type": "alert", "severity": "danger", "placeholder": "Absolute or relative contraindications." }
      ]
    },
    {
      "id": "sec_assessment",
      "type": "section",
      "title": "Initial Assessment",
      "required": true,
      "description": "First actions on patient encounter",
      "placeholder_blocks": [
        { "type": "checklist", "placeholder": "Primary survey (ABC, vitals, consciousness)." }
      ]
    },
    {
      "id": "sec_intervention",
      "type": "section",
      "title": "Intervention",
      "required": true,
      "description": "Treatment steps",
      "placeholder_blocks": [
        { "type": "alert", "severity": "warning", "placeholder": "Time-critical warnings." },
        {
          "id": "blk_int_meds",
          "type": "dosage_table",
          "required": true,
          "placeholder": "First-line medications."
        },
        { "type": "steps", "placeholder": "Supportive care actions." }
      ]
    },
    {
      "id": "sec_monitoring",
      "type": "section",
      "title": "Post-intervention Monitoring",
      "required": false,
      "description": "What to watch and for how long",
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Monitoring parameters, frequency, duration." }
      ]
    },
    {
      "id": "sec_escalation",
      "type": "section",
      "title": "Escalation Criteria",
      "required": false,
      "description": "When to transfer, consult, or escalate",
      "placeholder_blocks": [
        { "type": "decision", "placeholder": "Decision point for escalation." }
      ]
    },
    {
      "id": "sec_references",
      "type": "section",
      "title": "References",
      "required": false,
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Evidence base, guidelines, literature." }
      ]
    }
  ]
}
```

### Example protocols from this template
- Anaphylaxis Management
- Stroke Code Activation
- Massive Hemorrhage Protocol
- Status Epilepticus
- Sepsis Bundle

---

## 4. Template 2 — Clinical Procedure

**Intended use:** Routine, non-emergent procedures with a defined workflow (minor surgeries, injections, infiltrations, joint aspiration, IUD insertion, skin biopsies).

**Why it's a starter:** Most specialists perform routine procedures weekly. This template captures pre-op / procedure / post-op flow without emergency-protocol overhead.

**Template creator's required-block decisions:**
- **Procedure Steps** (required) — the point of the template
- **Post-procedure Instructions** (required) — patient care after
- Everything else optional

### JSON Schema

```json
{
  "version": "1.0",
  "metadata": {
    "suggested_specialty": "general",
    "intended_use": "Routine clinical procedures with defined workflow"
  },
  "blocks": [
    {
      "id": "sec_indications",
      "type": "section",
      "title": "Indications",
      "required": false,
      "placeholder_blocks": [
        { "type": "text", "placeholder": "When this procedure is performed." }
      ]
    },
    {
      "id": "sec_preparation",
      "type": "section",
      "title": "Preparation",
      "required": false,
      "description": "Pre-procedure setup",
      "placeholder_blocks": [
        { "type": "checklist", "placeholder": "Materials, equipment, and patient prep." },
        { "type": "alert", "severity": "info", "placeholder": "Consent, allergies, and anticoagulation status." }
      ]
    },
    {
      "id": "sec_steps",
      "type": "section",
      "title": "Procedure Steps",
      "required": true,
      "description": "Step-by-step technique",
      "placeholder_blocks": [
        { "type": "steps", "placeholder": "Numbered steps of the procedure." }
      ]
    },
    {
      "id": "sec_complications",
      "type": "section",
      "title": "Possible Complications",
      "required": false,
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Expected and rare adverse events." },
        { "type": "alert", "severity": "warning", "placeholder": "Signs that require immediate attention." }
      ]
    },
    {
      "id": "sec_post",
      "type": "section",
      "title": "Post-procedure Instructions",
      "required": true,
      "description": "Care after the procedure",
      "placeholder_blocks": [
        { "type": "checklist", "placeholder": "Patient instructions and follow-up care." }
      ]
    }
  ]
}
```

### Example protocols from this template
- Joint Aspiration
- Suturing a Laceration
- Infiltration with Corticosteroid
- IUD Insertion
- Cryotherapy for Skin Lesion

---

## 5. Template 3 — Pharmacological Reference

**Intended use:** Medication-heavy protocols where the core content is a dosing table plus contextual guidance (insulin regimens, antibiotic stewardship, pediatric dosing, anesthetic protocols, psychiatric medication titration).

**Why it's a starter:** Many doctors keep medication references on scraps of paper or in their heads. This template gives them a clean, structured home for that knowledge.

**Template creator's required-block decisions:**
- **Dosage table** (required) — the reason for this template
- Everything else optional

### JSON Schema

```json
{
  "version": "1.0",
  "metadata": {
    "suggested_specialty": "pharmacology",
    "intended_use": "Medication dosing references"
  },
  "blocks": [
    {
      "id": "sec_indications",
      "type": "section",
      "title": "Indications",
      "required": false,
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Clinical situations this regimen addresses." }
      ]
    },
    {
      "id": "sec_warnings",
      "type": "section",
      "title": "Warnings & Contraindications",
      "required": false,
      "placeholder_blocks": [
        { "type": "alert", "severity": "danger", "placeholder": "Absolute contraindications." },
        { "type": "alert", "severity": "warning", "placeholder": "Relative contraindications and cautions." }
      ]
    },
    {
      "id": "sec_dosing",
      "type": "section",
      "title": "Dosing",
      "required": true,
      "description": "Medication regimen",
      "placeholder_blocks": [
        {
          "id": "blk_dose_table",
          "type": "dosage_table",
          "required": true,
          "placeholder": "Drugs, doses, routes, frequencies, and notes."
        },
        { "type": "text", "placeholder": "Dose adjustments for renal/hepatic impairment." }
      ]
    },
    {
      "id": "sec_monitoring",
      "type": "section",
      "title": "Monitoring",
      "required": false,
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Labs, vitals, or symptoms to monitor; frequency." }
      ]
    },
    {
      "id": "sec_decision",
      "type": "section",
      "title": "Dose Adjustment Rules",
      "required": false,
      "placeholder_blocks": [
        { "type": "decision", "placeholder": "When to adjust, hold, or escalate the dose." }
      ]
    },
    {
      "id": "sec_adverse",
      "type": "section",
      "title": "Adverse Effects",
      "required": false,
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Common and serious adverse effects to counsel about." }
      ]
    }
  ]
}
```

### Example protocols from this template
- Basal-Bolus Insulin Regimen
- Community-Acquired Pneumonia Antibiotic Selection
- Pediatric Analgesic Dosing
- ICU Sedation Protocol
- Warfarin Initiation & Titration

---

## 6. Template 4 — Diagnostic Algorithm

**Intended use:** Decision pathways for establishing a diagnosis (chest pain evaluation, syncope workup, pediatric fever, abdominal pain differential, headache red flags).

**Why it's a starter:** Diagnostic reasoning is often taught as algorithms. This template makes them first-class and reusable.

**Template creator's required-block decisions:**
- **Presenting Problem** (required) — the algorithm's entry point
- **Decision Pathway** (required) — the algorithm itself
- Everything else optional

### JSON Schema

```json
{
  "version": "1.0",
  "metadata": {
    "suggested_specialty": "general",
    "intended_use": "Diagnostic decision pathways"
  },
  "blocks": [
    {
      "id": "sec_presentation",
      "type": "section",
      "title": "Presenting Problem",
      "required": true,
      "description": "What triggers this algorithm",
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Chief complaint or presenting scenario." }
      ]
    },
    {
      "id": "sec_redflags",
      "type": "section",
      "title": "Red Flags",
      "required": false,
      "placeholder_blocks": [
        { "type": "checklist", "placeholder": "High-risk features requiring immediate action." }
      ]
    },
    {
      "id": "sec_history",
      "type": "section",
      "title": "Key History & Exam",
      "required": false,
      "placeholder_blocks": [
        { "type": "checklist", "placeholder": "Targeted history questions and exam findings." }
      ]
    },
    {
      "id": "sec_pathway",
      "type": "section",
      "title": "Decision Pathway",
      "required": true,
      "description": "Step-wise decision logic",
      "placeholder_blocks": [
        { "type": "decision", "placeholder": "First branch point." },
        { "type": "decision", "placeholder": "Second branch point." }
      ]
    },
    {
      "id": "sec_workup",
      "type": "section",
      "title": "Recommended Workup",
      "required": false,
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Tests, imaging, referrals for each diagnostic path." }
      ]
    },
    {
      "id": "sec_differential",
      "type": "section",
      "title": "Differential Diagnosis",
      "required": false,
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Most common and most dangerous alternative diagnoses." }
      ]
    }
  ]
}
```

### Example protocols from this template
- Chest Pain Triage
- Pediatric Fever Without Source
- Syncope Workup
- Headache Red Flag Evaluation
- Acute Low Back Pain Differential

---

## 7. Template 5 — Physiotherapy Session

**Intended use:** Rehabilitation session protocols combining assessment, progression rules, and exercise prescription (post-ACL rehab, shoulder impingement, low back pain, stroke rehab, post-op knee replacement).

**Why it's a starter:** Physiotherapy was identified as a strong beachhead specialty for our go-to-market. Having a physiotherapy-native template at launch signals the product speaks their language.

**Template creator's required-block decisions:**
- **Assessment** (required) — can't treat without assessing
- **Treatment Plan** (required) — the session's content
- Everything else optional

### JSON Schema

```json
{
  "version": "1.0",
  "metadata": {
    "suggested_specialty": "physiotherapy",
    "intended_use": "Rehabilitation session structure with progression rules"
  },
  "blocks": [
    {
      "id": "sec_goals",
      "type": "section",
      "title": "Treatment Goals",
      "required": false,
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Short- and long-term goals for this phase of rehab." }
      ]
    },
    {
      "id": "sec_assessment",
      "type": "section",
      "title": "Assessment",
      "required": true,
      "description": "Evaluation at the start of each session",
      "placeholder_blocks": [
        { "type": "checklist", "placeholder": "Pain, ROM, strength, function tests to perform." },
        { "type": "text", "placeholder": "Outcome measures to track over time." }
      ]
    },
    {
      "id": "sec_progression",
      "type": "section",
      "title": "Progression Criteria",
      "required": false,
      "description": "When to advance the patient",
      "placeholder_blocks": [
        { "type": "decision", "placeholder": "Criteria to progress to the next phase." }
      ]
    },
    {
      "id": "sec_plan",
      "type": "section",
      "title": "Treatment Plan",
      "required": true,
      "description": "Interventions for this phase",
      "placeholder_blocks": [
        { "type": "steps", "placeholder": "Exercises, techniques, or modalities (with reps/sets/duration)." }
      ]
    },
    {
      "id": "sec_home",
      "type": "section",
      "title": "Home Exercise Program",
      "required": false,
      "placeholder_blocks": [
        { "type": "steps", "placeholder": "Exercises patient does at home between sessions." }
      ]
    },
    {
      "id": "sec_precautions",
      "type": "section",
      "title": "Precautions",
      "required": false,
      "placeholder_blocks": [
        { "type": "text", "placeholder": "Movements, loads, or activities to avoid in this phase." }
      ]
    }
  ]
}
```

### Example protocols from this template
- Post-ACL Reconstruction — Phase 1 (0–6 weeks)
- Shoulder Impingement — Conservative Management
- Chronic Low Back Pain — McKenzie Approach
- Post–Total Knee Replacement — Phase 2
- Post-Stroke Upper Limb Rehab

---

## 8. Seeding Strategy

### Database Seeding

On first launch of a tenant:

1. A one-time migration inserts these 5 templates into `ProtocolTemplate` with:
   - `tenant_id: null` (global/system templates)
   - `is_system: true`
   - `created_by: null` (or a dedicated "System" user)
   - `schema`: the JSON from sections 3–7 above
2. Templates are read-only to tenants — they appear in the template picker but cannot be edited directly
3. A tenant can **fork** a system template to create a tenant-owned editable copy

### Upgrading System Templates

When we improve a system template (e.g. new block types in v2):

- The system template's `schema` is updated in place, with `version` incremented
- Tenant-owned protocols using the old template version are flagged for review but not auto-migrated
- Forked copies are unaffected (they're independent)

### Template Picker UX

When a doctor creates a new protocol, the picker shows:

```
Start from a template
├── 🚨 Emergency Intervention      [System]
├── 🩹 Clinical Procedure          [System]
├── 💊 Pharmacological Reference   [System]
├── 🩺 Diagnostic Algorithm        [System]
├── 🏃 Physiotherapy Session       [System]
├── ─── Your templates ───
│   (empty in MVP — template creation is v2)
└── Start from scratch (blank)
```

Emojis here are illustrative — the actual UI will use consistent iconography.

## 9. Localization

All starter templates ship in **Spanish** (default) and **English**.

### Spanish is the Authoritative Version

Since the DR is our launch market:

- Template titles, section titles, and placeholder text are authored first in Spanish
- English is a translation
- The database stores both; user's language preference determines which renders

### Implementation

The `schema` JSON field stores a single language at a time. To support multiple languages, one of two patterns is used:

**Option A (recommended for MVP):** one `ProtocolTemplate` row per language, linked by a shared `template_key` field.

```sql
ALTER TABLE protocol_templates ADD COLUMN template_key TEXT;
ALTER TABLE protocol_templates ADD COLUMN locale TEXT;
```

Query pattern: `WHERE template_key = 'emergency-intervention' AND locale = 'es'`.

**Option B (future):** nested locale objects inside the schema JSON.

Option A is simpler to index, simpler to query, and makes the "same template, different language" relationship explicit.

### Translation Notes

Some clinical terms have regionally specific preferred translations:

- "Dosing" → "Dosificación" (not "Dosaje")
- "Workup" → "Estudios" or "Abordaje diagnóstico"
- "Red flags" → "Signos de alarma"
- "Follow-up" → "Seguimiento"
- "Discharge" → "Alta"

A translation glossary should be maintained as the product grows, ideally in collaboration with native-speaker clinical advisors.
