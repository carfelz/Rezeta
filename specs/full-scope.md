# Full Product Scope — Medical ERP

> Living document. Last updated: April 2026.
>
> This document captures the **full vision** for the product across all tiers — solo specialist, small practice, clinic, and enterprise. It is deliberately aspirational. For what ships first, see [`mvp-scope.md`](./mvp-scope.md).

## Table of Contents

1. [Vision & Positioning](#1-vision--positioning)
2. [User Personas](#2-user-personas)
3. [Module Map](#3-module-map)
4. [Core Clinical Modules](#4-core-clinical-modules)
5. [Protocol Engine](#5-protocol-engine)
6. [Administrative Modules](#6-administrative-modules)
7. [Patient-Facing Modules](#7-patient-facing-modules)
8. [Intelligence & Analytics](#8-intelligence--analytics)
9. [Integrations & Interoperability](#9-integrations--interoperability)
10. [Compliance, Security & Trust](#10-compliance-security--trust)
11. [Platform & Infrastructure](#11-platform--infrastructure)
12. [Monetization Beyond Subscription](#12-monetization-beyond-subscription)
13. [Phased Roadmap](#13-phased-roadmap)

---

## 1. Vision & Positioning

**What we're building:** A medical ERP that scales from solo specialist to enterprise hospital, built natively for the way Latin American doctors actually practice — across multiple centers, in Spanish, with a protocol engine as a first-class differentiator.

**North Star:** Become the default operating system for ambulatory medical practice in LATAM.

**What we're NOT (even at full scope):**
- A hospital information system (HIS) for inpatient care
- A standalone telemedicine platform
- A pure insurance claim processor

## 2. User Personas

| Persona | Description | Primary Needs |
|---------|-------------|---------------|
| **Solo Specialist** | Works at 2–4 centers; runs their own practice | Speed, multi-location, low overhead |
| **Practice Owner** | Owns a small practice with 2–10 providers | Team coordination, shared resources, reporting |
| **Clinic Administrator** | Manages operations at a medium clinic | Governance, compliance, financial control |
| **Provider (employee)** | Doctor working for a clinic | Clinical tools, protocols, easy documentation |
| **Nurse / Assistant** | Clinical support staff | Vitals entry, patient prep, follow-up |
| **Secretary / Receptionist** | Front-desk staff | Scheduling, check-in, billing |
| **Billing Clerk** | Financial operations | Invoicing, claims, collections |
| **Patient** | End recipient of care | Booking, records access, communication |
| **Medical Director** | Clinical leadership | Protocol governance, quality oversight |
| **System Admin / IT** | Technical administration | User management, integrations, audit |

## 3. Module Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MEDICAL ERP — FULL MODULE MAP                    │
├──────────────────────┬──────────────────────┬───────────────────────┤
│   CORE CLINICAL      │   ADMINISTRATIVE     │   PATIENT-FACING      │
│ • Patients           │ • Multi-Location     │ • Patient Portal      │
│ • Appointments       │ • Billing/Invoicing  │ • Online Booking      │
│ • Consultations      │ • Insurance Claims   │ • Telemedicine        │
│ • Prescriptions      │ • Financial Reports  │ • Messaging           │
│ • Lab & Imaging      │ • Inventory          │ • Educational Content │
│ • Protocols          │ • Staff Management   │ • Health Tracking     │
│ • Medical Docs       │ • Document Mgmt      │                       │
│ • Vaccinations       │ • Commission Mgmt    │                       │
├──────────────────────┼──────────────────────┼───────────────────────┤
│  INTELLIGENCE        │  INTEGRATIONS        │  COMPLIANCE & TRUST   │
│ • Analytics          │ • Labs               │ • Audit Logs          │
│ • KPI Dashboards     │ • Pharmacies         │ • Data Export         │
│ • Clinical Insights  │ • Insurance          │ • Backup & Recovery   │
│ • Predictive Alerts  │ • HL7/FHIR           │ • Role-Based Access   │
│ • Benchmarking       │ • Payment Gateways   │ • Regulatory Tools    │
│ • Custom Reports     │ • Calendars          │ • E-Signatures        │
│                      │ • Messaging (WA/SMS) │                       │
└──────────────────────┴──────────────────────┴───────────────────────┘
```

## 4. Core Clinical Modules

### 4.1 Patient Management

**Basic (MVP):**
- Demographics, contact info, emergency contacts
- Medical history (allergies, chronic conditions)
- Document uploads (lab results, images)
- Doctor-owned patient relationships

**Full Scope:**
- Family history tracking
- Genetic predisposition flags
- Vaccination records with due-date reminders
- Growth charts (pediatric)
- Anthropometrics tracking over time
- Patient photos / ID photos
- Identity verification (cédula validation)
- Patient merging (deduplication)
- Patient sharing between doctors (referrals, second opinions)
- Patient tagging and custom fields
- Patient timelines (unified view of all events)
- Clinical risk scoring
- Social determinants of health tracking
- Emergency band / patient wristband QR codes

### 4.2 Appointments & Scheduling

**Basic (MVP):**
- Calendar view per doctor per location
- Create, reschedule, cancel appointments
- Location-aware conflict detection
- Status tracking (scheduled → completed)

**Full Scope:**
- Recurring appointments
- Waitlists with automatic promotion
- Online self-booking by patients
- Automated reminders (SMS, WhatsApp, email)
- Appointment types with different durations
- Room/resource booking (e.g., ultrasound room)
- Multi-provider appointments (team visits)
- Travel time buffers between locations
- Color-coded calendars per location
- Drag-and-drop rescheduling
- Patient no-show tracking and policies
- Overbooking policies (configurable)
- Block booking (reserve time for admin tasks)
- Calendar sync with Google/Outlook/iCal
- Queue management (walk-ins)
- Check-in kiosk mode

### 4.3 Consultations (Electronic Health Records)

**Basic (MVP):**
- SOAP note structure (Subjective, Objective, Assessment, Plan)
- Vitals capture
- Free-text diagnoses
- Sign & amend workflow for immutability

**Full Scope:**
- Customizable consultation templates per specialty
- Voice-to-text for note dictation
- AI-assisted note drafting from conversation
- Vitals trends and graphs over time
- Structured findings (review of systems, physical exam by region)
- Body chart annotations (for injuries, rashes, etc.)
- Photo documentation with annotations
- Quick-add macros / smart phrases
- Problem list management
- Medication reconciliation
- Allergy alerts during prescription
- Clinical decision support alerts
- Teleconsultation mode (video embedded)
- Follow-up task generation
- Referral letter generation
- Auto-save and conflict resolution
- Multi-provider notes on same consultation

### 4.4 Prescriptions

**Basic (MVP):**
- Drug, dose, route, frequency, duration, instructions
- Printable PDF with doctor credentials
- Sign & amend workflow

**Full Scope:**
- Drug interaction checking
- Allergy cross-checking
- Dose calculation by weight/age (pediatrics)
- Formulary management
- Favorite prescriptions / templates
- Electronic prescribing to pharmacies (where legally supported)
- Controlled substance tracking (compliance)
- Repeat prescriptions and auto-refill workflows
- Multi-language prescription output
- QR code for pharmacy verification
- Generic substitution suggestions
- Medication adherence tracking

### 4.5 Lab & Imaging Orders and Results

**Not in MVP — full scope only:**
- Order sets for common panels (CBC, metabolic, etc.)
- Electronic order submission to labs
- Results ingestion (manual upload + HL7/FHIR feeds)
- Result trending over time
- Abnormal value flagging
- Clinical interpretation templates
- Imaging viewer (DICOM support)
- Radiology report parsing
- Patient notification of results
- Critical value alerting protocols

### 4.6 Medical Documentation

**Documents doctors need to produce:**
- Prescriptions ✓ (own module)
- Medical certificates (sick leave, fitness for work, travel)
- Referral letters
- Discharge summaries
- Consent forms
- Informed consent digital signing
- Death certificates
- Birth certificates (where applicable)
- Insurance pre-authorization letters
- Second opinion reports
- Custom templates per specialty

### 4.7 Vaccinations

**Not in MVP — dedicated module for pediatric/preventive practice:**
- National vaccination schedule (DR, customizable per country)
- Vaccine inventory tracking
- Lot and expiration management
- Due-date reminders for patients
- Catch-up schedule calculation
- Vaccination certificates (WHO-compatible)
- Adverse event reporting

## 5. Protocol Engine

This is the **strategic differentiator** of the product. See also future `protocol-template-schema.md`.

### 5.1 MVP (Lite)
- Pre-built templates
- Personal protocol library
- Search and favorites

### 5.2 Full Scope

**Template Management:**
- Create custom templates from scratch
- Block-based editor (checklist, stepwise, decision branch, dosage table, alerts, references)
- Required vs optional blocks
- Template marketplace (community-contributed, moderated)
- Template versioning

**Protocol Creation:**
- Fill-in experience based on template schema
- Rich text, tables, images, attachments
- Cross-reference other protocols
- External link support
- Embedded calculators (BMI, GFR, dosing)

**Governance:**
- Draft → Review → Approved workflow
- Review cycles (auto-expire protocols needing renewal)
- Multi-signer approval
- Version history with diff view
- Change summaries
- Protocol endorsements (by medical directors)

**Sharing & Community:**
- Private / practice-shared / public visibility levels
- Fork public protocols into your own library
- Attribution to original authors
- Upvoting / usefulness signals
- Flag inappropriate protocols
- Curated vs community-contributed tiers
- Verified by platform experts badge

**Clinical Integration:**
- Launch protocol from inside a consultation
- Auto-document steps taken in SOAP note
- Protocol adherence tracking
- Deviation logging with rationale
- Link to orders and prescriptions
- Link to patient outcomes
- Timer support (for timed interventions)

**Analytics:**
- Most-used protocols
- Time-to-complete per protocol
- Deviation patterns
- Outcome correlations
- Team-level protocol adoption

## 6. Administrative Modules

### 6.1 Multi-Location Management

**Basic (MVP):**
- Unlimited locations
- Per-location fees and commissions
- Location-aware scheduling

**Full Scope:**
- Location-specific branding on documents
- Per-location working hours and holidays
- Per-location tax configuration
- Per-location resource/room inventory
- Location comparison reports
- Center-level access controls
- Floor/suite/room hierarchy

### 6.2 Billing & Invoicing

**Basic (MVP):**
- Invoice generation per consultation
- Commission split per location
- Payment tracking

**Full Scope:**
- Multiple payment methods (cash, card, transfer, check)
- Partial payments and payment plans
- Refunds and credits
- Automated late-payment reminders
- Bulk invoicing
- Recurring billing for packages
- Gift cards / prepaid credits
- Tax compliance (ITBIS in DR, VAT elsewhere)
- Fiscal receipt integration (NCF in DR)
- Invoice customization and branding
- Multi-currency support

### 6.3 Insurance Claims

**Not in MVP — major module for v2+:**
- Pre-authorization workflows
- Claim submission (ARS integration in DR)
- Claim status tracking
- Denial management
- Appeals workflow
- EOB (Explanation of Benefits) parsing
- Insurance eligibility verification
- Co-pay calculation
- Bundled billing (capitation)

### 6.4 Financial Reports

**Full Scope:**
- Revenue by doctor, location, specialty, period
- Commission reports for third-party centers
- Accounts receivable aging
- Payment method breakdown
- Cash flow projections
- Profit & loss per location
- Tax summary reports
- Insurance vs self-pay analysis
- Custom report builder
- Scheduled report delivery
- Export to accounting software (QuickBooks, Xero)

### 6.5 Inventory Management

**Not in MVP — for clinics with in-house pharmacy/supplies:**
- Medication inventory with lot/expiration tracking
- Medical supply tracking
- Equipment tracking and maintenance schedules
- Automatic reorder points
- Purchase order generation
- Supplier management
- Cost tracking and margin analysis
- Waste / expired tracking
- Cold chain monitoring (for vaccines)

### 6.6 Staff & Role Management

**Full Scope:**
- Multi-user with granular permissions
- Role templates (doctor, nurse, secretary, admin, billing)
- Custom role creation
- Per-location access control
- Credentialing and license tracking
- License expiration alerts
- Continuing education (CME) tracking
- Staff schedule management
- Time tracking / attendance
- Payroll integration
- Performance metrics per staff member

### 6.7 Document Management

**Full Scope:**
- Centralized document library
- Document templates (contracts, forms, HR)
- Version control
- Digital signatures (local + eIDAS / DR-specific)
- Document expiration tracking
- Secure sharing with external parties
- OCR for scanned documents
- Full-text search across documents

### 6.8 Commission & Revenue Sharing

**Critical for DR market:**
- Per-location commission percentages
- Per-procedure commission overrides
- Automatic commission calculation on invoice
- Commission statements for centers
- Payout scheduling
- Commission disputes and resolution
- Multi-level commission splits (for referrals)

## 7. Patient-Facing Modules

### 7.1 Patient Portal

**Not in MVP:**
- Secure login (OAuth, biometric on mobile)
- View upcoming appointments
- Request appointments / cancel
- Access test results
- View prescriptions
- Download medical history
- Update personal info
- Consent management
- Bill payment
- Pre-visit questionnaires

### 7.2 Online Self-Booking

**Not in MVP — major conversion driver:**
- Public booking page per doctor
- Real-time availability
- Specialty and location filtering
- Patient self-registration
- Insurance verification at booking
- Booking confirmations via preferred channel
- Integration with Google/social profiles

### 7.3 Telemedicine

**Not in MVP:**
- Built-in video consultation
- Screen sharing for reviewing results
- Recording (with consent)
- Virtual waiting room
- Integration with consultation notes
- Payment during/after virtual visit
- Prescription delivery post-visit

### 7.4 Patient Messaging

**Not in MVP:**
- Secure in-app messaging
- WhatsApp Business API integration
- SMS fallback
- Automated follow-up messages
- Templated message library
- AI-drafted message suggestions
- Message triage by staff before doctor
- Compliance-safe retention policies

### 7.5 Educational Content Delivery

**Not in MVP:**
- Patient education library
- Doctor-curated content recommendations
- Post-consultation care instructions
- Multi-language content
- Content analytics (did patient open? read?)

### 7.6 Health Tracking

**Not in MVP — wellness/chronic care focus:**
- Patient-reported outcomes
- Home vitals integration (BP cuffs, glucometers, wearables)
- Symptom journals
- Medication adherence tracking
- Goal setting and progress tracking
- Alerts to doctor for concerning values

## 8. Intelligence & Analytics

### 8.1 Practice Analytics

**Full Scope:**
- Daily/weekly/monthly dashboards
- Appointment metrics (show rate, no-show, utilization)
- Revenue trends
- Patient acquisition and retention
- Most common diagnoses
- Average consultation duration
- Peak hours and bottlenecks
- Geographic patient distribution

### 8.2 Clinical Insights

**Full Scope:**
- Patient cohort analysis
- Outcome tracking per protocol
- Quality measures (e.g., HbA1c control rates for diabetics)
- Population health dashboards
- Chronic disease registries
- Preventive care gap identification

### 8.3 Predictive & AI Features

**Future:**
- Appointment no-show prediction
- Churn risk for patients
- Revenue forecasting
- Diagnostic suggestions (carefully, with clear advisory framing)
- Drug interaction and contraindication warnings
- Readmission risk
- Auto-coding for billing

### 8.4 Benchmarking

**Future:**
- Anonymized peer comparisons
- Specialty benchmarks (income, patient volume, outcomes)
- Opt-in data contribution
- Regional trends

### 8.5 Custom Reports & BI

**Future:**
- Report builder interface
- Saved reports with scheduled delivery
- Data warehouse export
- Tableau / Power BI / Looker connectors

## 9. Integrations & Interoperability

### 9.1 Standards Support

- **HL7 v2 & FHIR R4** — for interoperability with labs, hospitals, insurance
- **DICOM** — for imaging integration
- **SNOMED CT / ICD-10** — optional, for markets requiring coded diagnoses
- **LOINC** — for lab results coding

### 9.2 Third-Party Integrations

**Labs:**
- Referencia Laboratorio Clínico (DR)
- Amadita
- Roche / other national networks

**Pharmacies:**
- Major DR pharmacy chains (Carol, Medicar, etc.)
- E-prescription delivery

**Insurance (ARS in DR):**
- SeNaSa
- Humano
- Mapfre Salud
- Universal
- ARS Palic

**Payment Processors:**
- Azul (DR)
- CardNet (DR)
- Stripe (international)
- PayPal

**Calendars:**
- Google Calendar
- Outlook / Microsoft 365
- Apple iCloud

**Communication:**
- WhatsApp Business API
- SMS (Twilio, local providers)
- Email (SendGrid, Postmark)

**Accounting:**
- QuickBooks
- Xero
- Contabilizalo (LATAM-specific)

**Identity:**
- Google SSO
- Microsoft SSO
- Apple Sign In
- Local eID providers

### 9.3 API & Webhooks

**Public API for integrations:**
- REST API with OpenAPI spec
- Webhook events for key actions
- OAuth 2.0 authorization
- Rate limiting and usage tiers
- Developer portal and documentation
- SDKs for common languages

## 10. Compliance, Security & Trust

### 10.1 Regulatory Compliance

- **DR Law 87-01** on personal data
- **HIPAA** (for US expansion)
- **GDPR** (for EU expansion)
- **LGPD** (Brazil, for LATAM expansion)
- **Local health ministry requirements** per country
- **Medical association standards** per country

### 10.2 Security

- End-to-end encryption in transit (TLS 1.3+)
- Encryption at rest (AES-256)
- Field-level encryption for PII
- Regular penetration testing
- Bug bounty program
- SOC 2 Type II certification target
- ISO 27001 certification target
- Password policies and MFA
- Biometric login on mobile
- Session management and timeouts
- Device management and trust
- IP allowlisting for enterprise

### 10.3 Audit & Transparency

- Complete audit logs of all actions
- Audit log export for compliance
- Access logs per patient record
- Break-glass access with justification
- Change history for every record
- Data lineage tracking

### 10.4 Patient Rights

- Right to access their data
- Right to export (data portability)
- Right to deletion (with legal retention carve-outs)
- Right to rectification
- Consent management dashboard
- Purpose-specific data sharing controls

### 10.5 Business Continuity

- Automated backups (multiple times per day)
- Geo-redundant storage
- Point-in-time recovery
- Disaster recovery playbooks
- RPO < 1 hour, RTO < 4 hours targets
- Status page with uptime history
- Planned maintenance windows

## 11. Platform & Infrastructure

### 11.1 Client Platforms

- Responsive web app (primary)
- Progressive Web App (mobile-first fallback)
- Native iOS app
- Native Android app
- Desktop app (Electron) — optional, low priority
- Check-in kiosk mode (tablet)
- Patient-facing mini-apps

### 11.2 Offline & Low-Connectivity

- Offline consultation drafting (sync on reconnect)
- Cached patient records for frequently seen patients
- Conflict resolution on sync
- Progressive data loading

### 11.3 Performance Targets

- Initial app load < 2s on 4G
- Patient search results < 500ms
- Consultation save < 200ms
- Video consultation < 300ms latency

### 11.4 Scalability

- Multi-tenant architecture with tenant isolation
- Horizontal scaling of API servers
- Read replicas for reporting workloads
- Queue-based async processing
- CDN for static assets
- Multi-region deployment (future)

### 11.5 Internationalization

- Multi-language UI (Spanish, English, Portuguese future)
- Multi-currency billing
- Multi-timezone support
- Locale-aware date/number formatting
- Language-specific content (protocols, patient education)

## 12. Monetization Beyond Subscription

### 12.1 Add-On Modules

- Telemedicine bundle
- Advanced analytics package
- Extra storage tier
- White-label branding
- Priority support tier

### 12.2 Transaction-Based

- Small fee on processed billing (optional, carefully priced)
- Payment processing spread
- Premium SMS/WhatsApp volumes

### 12.3 Marketplace Revenue

- Lab integration referral fees
- Pharmacy integration fees
- Insurance integration fees
- Equipment/supply vendor partnerships
- Continuing education partnerships
- Insurance product referrals (where legally allowed)

### 12.4 Data & Insights (Ethically)

- Anonymized benchmarking data (opt-in)
- Market research partnerships with pharma (strict consent, regulated)
- Public health reporting contracts with governments

### 12.5 Professional Services

- White-glove onboarding for clinics
- Data migration from legacy systems
- Custom integration development
- Training programs
- Certification for power users

### 12.6 Ancillary Products (Long-Term)

- Medical billing services (outsourced billing using our platform)
- Virtual medical scribes powered by AI
- Practice financing / medical equipment leasing partnerships
- Malpractice insurance partnerships

## 13. Phased Roadmap

### Phase 1 — MVP (Months 0–6)
See [`mvp-scope.md`](./mvp-scope.md). Solo specialist focus.

### Phase 2 — Practice Tier (Months 6–12)
- Multi-user with roles
- Shared resources (patients, protocols, schedules)
- Basic analytics dashboard
- Native mobile apps
- Advanced protocol engine (custom templates, versioning)
- WhatsApp integration
- Online self-booking
- Basic telemedicine

### Phase 3 — Clinic Tier (Months 12–24)
- Department and multi-location governance
- Insurance claims module
- Lab integrations (top DR labs)
- Inventory management
- Staff credentialing
- Advanced financial reporting
- Patient portal
- HL7/FHIR interoperability
- Compliance tooling

### Phase 4 — Enterprise & Intelligence (Months 24–36)
- Hospital-grade features (but not HIS)
- Predictive analytics and AI
- Benchmarking network
- Marketplace launch
- API platform with partners
- Multi-country expansion (Colombia, Mexico, Central America)
- Public API and SDK

### Phase 5 — Platform (Months 36+)
- Developer ecosystem
- Vertical-specific configurations
- AI-native features (voice-first documentation, ambient scribes)
- Regional data network effects
- B2B2C expansion (selling to centros médicos directly)

---

## Notes & Design Principles

Throughout all phases, these principles hold:

1. **Progressive complexity** — simple for solo, powerful for clinics. No forced migration.
2. **Multi-tenancy and isolation** — non-negotiable from day one.
3. **Doctor-owned patients** — specialists take their relationships with them.
4. **Immutability of clinical records** — sign + amend, never silent edit.
5. **Protocol engine as differentiator** — always first-class.
6. **Local-first, global-ready** — built for DR/LATAM, portable to other markets.
7. **Compliance built-in** — not bolted-on later.
8. **Bilingual by default** — Spanish and English at every level.
