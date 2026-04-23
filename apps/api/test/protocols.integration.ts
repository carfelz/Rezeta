/**
 * SUPERSEDED — This integration test suite was written against the old protocol engine model
 * (system-global templates, direct templateId on protocols, optional title/typeId).
 *
 * It has been disabled as part of Slice A (schema rework). The new model requires:
 *   - Protocol.typeId (required) instead of Protocol.templateId (removed)
 *   - Protocol.title (required, min 2 chars) — no defaulting from template name
 *   - ProtocolType as the user-facing category (Slice D)
 *   - Tenant-owned templates (never system-global)
 *
 * This file will be rewritten in Slice 2+3 using the new type-picker flow.
 * Until then, all tests here are intentionally skipped.
 */

describe.skip('Protocols Integration (superseded — rewrite in Slice 2+3)', () => {
  it.skip('placeholder', () => {})
})
