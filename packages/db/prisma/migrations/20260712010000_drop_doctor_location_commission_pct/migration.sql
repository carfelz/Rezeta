-- Drop the now-unused DoctorLocation.commission_pct column.
--
-- Commission is read exclusively from Location.commission_percent (the single source the
-- settings UI maintains). doctor_locations.commission_pct was only ever written at create
-- time and never updated, and after the 2026-07-12 commission-source fix it is read
-- nowhere in application code. Removing it eliminates the stale duplicate.

ALTER TABLE "doctor_locations" DROP COLUMN "commission_pct";
