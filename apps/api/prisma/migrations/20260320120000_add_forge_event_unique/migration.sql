-- Remove duplicate EventProgress rows for the same (playerId, eventCode),
-- keeping the most recently updated row to avoid constraint violations.
DELETE FROM "event_progress" a
USING "event_progress" b
WHERE a."playerId" = b."playerId"
  AND a."eventCode" = b."eventCode"
  AND a."updatedAt" < b."updatedAt";

-- AddUniqueConstraint
ALTER TABLE "event_progress" ADD CONSTRAINT "event_progress_player_id_event_code_key" UNIQUE ("playerId", "eventCode");
