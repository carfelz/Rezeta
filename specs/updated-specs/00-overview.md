# Rezeta — Updated Specs Overview

> Created: May 2026.
> These specs supersede the consultation and protocol sections of the original MVP scope.
> They reflect a workflow-first redesign based on how DR specialists actually practice.

## Why These Specs Exist

The original specs were module-centric: they described what each entity does, not how a doctor moves through the app during a patient encounter. Three problems drove the revamp:

1. **Consultation workflow was disjointed.** The consultation gate forced protocol selection before the SOAP form opened — backwards from how doctors think (assess the patient first, then decide on a protocol).
2. **SOAP was a forced structure.** Not every specialty uses SOAP. An emergency physician, a physiotherapist, and a cardiologist document differently. Hard-coding `subjective / objective / assessment / plan` as fixed DB columns excluded these workflows.
3. **The protocol model was over-engineered.** The 3-layer Template → ProtocolType → Protocol cascade, with its total lock rules, made templates essentially immutable after first use. Doctors would never learn this constraint exists until they tried to improve a template and hit a wall.

## What Changed

| Area | Old | New |
|---|---|---|
| Consultation entry | Gate forced protocol before SOAP | Two entry paths (planned + walk-in); protocol added any time during encounter |
| SOAP fields | Fixed columns on `Consultation` | Removed. Documentation lives in `clinical_notes` protocol blocks |
| Vitals | Fixed JSONB on `Consultation` | Removed. `vitals` block in protocol catalog — template author picks which fields |
| Consultation states | `draft` / `signed` | `open` / `signed` / `amended` |
| Protocol model | 3 layers (Template → Type → Protocol) | 2 layers (Template → Protocol) |
| ProtocolType | Structural enforcer with template lock | Replaced by `ProtocolCategory` — name + color tag only |
| Lock rules | Total template lock when any Type references it | Removed entirely. ProtocolUsage snapshot is the integrity mechanism |
| Block catalog | 7 block types | 9 block types (+ `vitals`, + `clinical_notes`) |

## What Stays the Same

- Multi-tenancy (`tenant_id` on every record) — unchanged
- Doctor-owned patients (`Patient.owner_user_id`) — unchanged
- Soft deletes only (`deleted_at`) — unchanged
- UUIDs for all PKs — unchanged
- Audit trail on everything — unchanged
- `ProtocolVersion` immutability (every save creates a new version) — unchanged
- `ProtocolUsage` working-copy snapshot model — unchanged
- `ConsultationAmendment` for corrections to signed records — unchanged
- Orders (Prescription, LabOrder, ImagingOrder) with multiple groups — unchanged
- Billing / Invoice model — unchanged
- Multi-location (Appointment, Consultation, Invoice link to `location_id`) — unchanged

## Spec Files in This Directory

| File | Covers |
|---|---|
| `01-consultation-workflow.md` | Full consultation lifecycle — entry paths, states, UX model, DB entity |
| `02-protocol-model.md` | 2-layer protocol model, ProtocolCategory, block catalog, ProtocolUsage |
| `03-orders-and-documents.md` | Order types, groups, queue, PDF generation, DR-specific requirements |

## Database Reset Note

No production data exists. All schema changes in these specs can be applied as clean migrations (drop + recreate). No data migration scripts needed.
