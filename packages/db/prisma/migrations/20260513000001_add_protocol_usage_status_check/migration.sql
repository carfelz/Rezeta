-- Enforce the four valid values of protocol_usages.status at the DB level.
-- Valid: in_progress | completed | abandoned | switched
-- Matches the ProtocolUsageStatus union in packages/shared.

ALTER TABLE "protocol_usages"
  ADD CONSTRAINT "protocol_usage_status_check"
  CHECK (status IN ('in_progress', 'completed', 'abandoned', 'switched'));
