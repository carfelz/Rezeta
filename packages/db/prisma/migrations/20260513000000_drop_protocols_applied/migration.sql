-- Drop legacy Consultation.protocols_applied column.
-- Superseded by the protocol_usages relation. No application code reads or writes it.
-- Any non-empty values are already represented in protocol_usages rows.

DO $$
DECLARE
  stale_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO stale_count
  FROM consultations
  WHERE protocols_applied <> '{}'::text[];

  IF stale_count > 0 THEN
    RAISE NOTICE 'Dropping protocols_applied: % consultations had non-empty values (data lives in protocol_usages)', stale_count;
  END IF;
END $$;

ALTER TABLE "consultations" DROP COLUMN "protocols_applied";
