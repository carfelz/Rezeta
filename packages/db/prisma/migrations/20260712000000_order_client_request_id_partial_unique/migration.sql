-- Convert the (consultation_id, client_request_id) idempotency indexes on the three
-- order tables from FULL unique to PARTIAL unique (WHERE deleted_at IS NULL), matching
-- the soft-delete convention already applied to protocol_categories / invoices /
-- protocol_versions in migration 20260626000000.
--
-- Why: the create-dedup lookups filter `deleted_at IS NULL`, but a FULL unique index
-- also counts soft-deleted rows. So create → soft-delete → retry with the same
-- client_request_id found nothing to dedup and then collided with the surviving index,
-- leaking a raw P2002. A partial index only constrains live rows, so a token becomes
-- reusable once its order is soft-deleted.
--
-- Safe on populated tables: the previous full unique index already guaranteed global
-- uniqueness, so the set of live rows is necessarily already unique — the partial index
-- cannot fail to build. Index names are reused so the schema's logical names stay stable.
-- DROP ... IF EXISTS keeps this idempotent.

-- prescriptions (consultation_id, client_request_id)
DROP INDEX IF EXISTS "prescriptions_consultation_id_client_request_id_key";
CREATE UNIQUE INDEX "prescriptions_consultation_id_client_request_id_key"
  ON "prescriptions" ("consultation_id", "client_request_id")
  WHERE "deleted_at" IS NULL;

-- imaging_orders (consultation_id, client_request_id)
DROP INDEX IF EXISTS "imaging_orders_consultation_id_client_request_id_key";
CREATE UNIQUE INDEX "imaging_orders_consultation_id_client_request_id_key"
  ON "imaging_orders" ("consultation_id", "client_request_id")
  WHERE "deleted_at" IS NULL;

-- lab_orders (consultation_id, client_request_id)
DROP INDEX IF EXISTS "lab_orders_consultation_id_client_request_id_key";
CREATE UNIQUE INDEX "lab_orders_consultation_id_client_request_id_key"
  ON "lab_orders" ("consultation_id", "client_request_id")
  WHERE "deleted_at" IS NULL;
