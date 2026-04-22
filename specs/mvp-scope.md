# MVP Scope — Medical ERP

> Living document. Last updated: April 2026.

## 1. Vision

A medical ERP built the way Dominican Republic specialists actually work — across multiple health centers, on one unified system. Starting with solo specialists and scaling naturally to small practices and clinics.

**Tagline candidates (Spanish):**

- _Un solo sistema, todos tus centros._
- _Tus pacientes te siguen donde consultes._

## 2. Target User (MVP)

**Primary:** Solo specialist in the Dominican Republic who consults at 2–4 different health centers per week.

**Pain points being solved:**

- Juggling schedules across multiple centers
- Keeping patient records scattered or on paper
- Remembering protocols from memory
- Tracking income and commission splits per center
- Writing legible prescriptions quickly

## 3. MVP Modules

### 🟢 Must-Have (ships in v1)

| #   | Module                       | Purpose                                                                |
| --- | ---------------------------- | ---------------------------------------------------------------------- |
| 1   | Patient Management           | Basic demographics, medical history, allergies, chronic conditions     |
| 2   | Multi-Location Management ⭐ | Core differentiator — unlimited locations even on free tier            |
| 3   | Appointments & Calendar      | Location-aware scheduling, conflict detection across centers           |
| 4   | Consultations / SOAP Notes   | Structured clinical notes with sign/amend workflow                     |
| 5   | Prescriptions                | Printable PDFs with doctor's credentials                               |
| 6   | Basic Billing / Invoicing    | Per-location fees and commission tracking                              |
| 7   | Protocol Engine              | Tenant-owned templates, types, onboarding flow, and full protocol CRUD |

### 🔴 Explicitly Out of Scope for MVP

These are valuable features, but deferred to v2+ to keep MVP focused:

- Lab/imaging integrations
- Inventory management
- Patient portal (self-booking, results, messaging)
- Advanced analytics & KPI dashboards
- Multi-user support beyond owner (v2)
- Protocol integration with consultations (v2)
- Template versioning (v2)
- Cross-tenant template/protocol sharing (v3)
- Telemedicine
- Insurance claim processing
- HL7/FHIR integrations

## 4. Protocol Engine in MVP

The protocol engine ships end-to-end in MVP. It is the product's primary differentiator; a "lite" version without customization would undercut the positioning. The engine is built on a three-layer model — **templates** (structural blueprints), **types** (tenant categories pointing at templates), **protocols** (instances belonging to types). See `protocol-template-schema.md` for the authoritative spec.

**In MVP:**

- Tenant-owned templates (copied from 5 starter blueprints on signup; editable subject to lock rules)
- `ProtocolType` as the user-facing category, sitting between templates and protocols
- 5 default types auto-created on tenant provisioning
- Onboarding flow (`/bienvenido`) with default-path and personalizar-path, gating protocol access until templates and types exist
- Template editor at `/ajustes/plantillas` (flat block list, required toggles, placeholder hints)
- Type CRUD at `/ajustes/tipos` (list, create, rename, delete)
- Protocol CRUD: create via type picker, edit in three-panel editor, view in mobile-optimized viewer, save as immutable versions
- Full-text search by title, filter by type, mark protocols as favorites
- Lock rules: templates locked when any type references them; types locked when any protocol references them

**Not in MVP:**

- Template versioning (edits are in-place; total lock is the compensating safeguard — v2)
- Type metadata beyond name + template (v2)
- Cross-tenant protocol/template sharing or public library (v3)
- Forking another tenant's content (v3)
- Protocol-to-consultation integration (launch a protocol during a consult — v2)
- Multi-signer approval workflows (v2)
- Usage analytics

## 5. Platform Strategy

| Platform           | MVP Approach              | Rationale                                      |
| ------------------ | ------------------------- | ---------------------------------------------- |
| Web                | Responsive web app        | Fastest to build, where admin-heavy tasks live |
| Mobile             | Progressive Web App (PWA) | Works on phones without native app overhead    |
| Native iOS/Android | Deferred to v2            | Build only after validating demand and revenue |

## 6. Localization & Compliance

- **Languages:** Spanish (default) and English toggle
- **Compliance:**
  - Dominican Republic Law 87-01 on personal data protection
  - HIPAA-aligned practices (for future US expansion readiness)
  - GDPR principles where applicable
- **Regional details:**
  - Currency: DOP (primary), USD (secondary)
  - Document types: Cédula, passport, RNC
  - Date/time formatting: DR locale

## 7. Data Model (Summary)

Full ERD lives in `medical_erp_erd.mmd`. Key entities in MVP:

**Foundation:** Tenant, User, Location, DoctorLocation, ScheduleBlock, ScheduleException

**Clinical:** Patient, Appointment, Consultation, ConsultationAmendment, Prescription

**Billing:** Invoice, InvoiceItem

**Protocols:** ProtocolTemplate, ProtocolType, Protocol, ProtocolVersion

**Cross-cutting:** AuditLog, Attachment

## 8. Key Architectural Principles

These must be baked in from day one, even if not fully exercised in MVP:

1. **Multi-tenancy** — every record tied to a `tenant_id`. Non-negotiable for healthcare.
2. **Soft deletes** — `deleted_at` flags instead of hard deletes, to respect medical data retention laws.
3. **Audit trail** — every create/update/delete logged with who, when, what changed.
4. **UUIDs** — not auto-increment IDs, for security and future multi-region sync.
5. **Immutability of signed records** — consultations, prescriptions, and invoices cannot be silently edited after signing. Corrections go through amendments.
6. **PostgreSQL with JSONB** — flexible fields for vitals, allergies, diagnoses, protocol content.
7. **Doctor-owned patients** — `owner_user_id` on Patient, so specialists take their patient relationships with them.

## 9. Success Criteria for MVP

What must be true for us to consider the MVP successful:

- [ ] A solo specialist can go from signup to first consultation logged in under 15 minutes
- [ ] Multi-location scheduling works without conflicts across 3+ centers
- [ ] Consultations can be signed and amendments tracked
- [ ] Prescriptions print professionally with doctor credentials
- [ ] Invoices correctly calculate per-location commissions
- [ ] 10 paying customers within 3 months of launch
- [ ] < 3% monthly churn
- [ ] NPS > 40 after 30 days of use

## 10. Open Questions

Things to finalize before or during build:

- [ ] Target specialty for first 10 customers (physiotherapy? pediatrics? cardiology?)
- [ ] Exact pricing (target ~$29–39/mo for solo, ~$99/mo for practice)
- [ ] Technical stack (backend framework, auth provider, hosting)
- [x] Protocol template schema (block types and JSON structure) — resolved in `protocol-template-schema.md`
- [ ] Roles & permissions matrix for v2 multi-user
- [ ] Payment processor for DR market (Azul? CardNet? Stripe?)

## 11. Roadmap After MVP

**v1.5 (3–6 months post-launch)**

- Assistant/secretary role (multi-user for solo practice)
- Basic analytics dashboard
- Native iOS/Android apps
- Protocol integration into consultations

**v2 (6–12 months post-launch)**

- Practice tier (2–10 providers)
- Template versioning (non-destructive template edits, existing protocols pinned to their authored version)
- Type metadata (tags, analytics, default location, specialty affinity)
- Protocol-to-consultation integration (launch a protocol during a consult, track adherence)
- Lab integrations
- Patient portal

**v3 (12+ months post-launch)**

- Clinic tier
- Multi-department governance
- Advanced compliance tooling
- HL7/FHIR integrations
- Marketplace & add-ons
