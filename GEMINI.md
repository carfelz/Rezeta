# Rezeta Medical ERP — Project Memory (Gemini)

This file contains the project context, recent updates, and audit details for Gemini.

## Recent Audit (2026-05-20)

A comprehensive QA audit was conducted on Rezeta by a Senior Software QA with medical software experience. The audit was divided into two aspects:

1. **Medical Usability & Workflow Assessment**: Evaluated the adoption likelihood for Dominican medical specialists, clinical safety (omnipresence of patient alerts in canvas view), identity attribution (legal compliance under Ley 42-01), and Dominican localization (cédula/RNC formatting and single prescription workflows).
2. **Technical Quality & Architecture Audit**: Reviewed code quality, structural changes in the recent sprint (May 8–19, 2026), and remaining technical debt.

### Core Outputs Generated

Two PDF reports have been generated in the project root:

- [medical_recommendations.pdf](file:///Users/carlosfeliz/code/medical_app/medical_recommendations.pdf) — Clinical and workflow findings, usability assessments, and Dominican Republic-specific regulatory recommendations.
- [technical_bugs.pdf](file:///Users/carlosfeliz/code/medical_app/technical_bugs.pdf) — Technical audit detailing resolved bugs from the previous static audit and next-steps for refactoring/architectural quality.

### Outstanding Technical Debt & Quality Tasks

- **checkedState Cleanup**: Complete Phase 2 and 3 of the dual-storage cleanup by migrating `ProtocolUsage` completely to the `modifications` JSON format and removing the obsolete `checkedState` column.
- **OpenAPI/Swagger Coverage**: Ensure all new API endpoints are fully decorated in NestJS controllers to maintain testability and developer integration quality.
- **Test Coverage**: Enforce the raised 95% per-file test coverage threshold across all packages (API, Web, Shared).
- **TypeScript Strictness**: Strictly prohibit `any` types in any new contributions.
- **DGII Validation**: Plan integration of Cédula/RNC formatting masks and validation routines against Dominican Tax Authority specs for the invoicing module.
