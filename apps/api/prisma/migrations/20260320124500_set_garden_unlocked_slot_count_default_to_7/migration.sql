ALTER TABLE "player_profiles"
ALTER COLUMN "gardenUnlockedSlotCount" SET DEFAULT 7;

UPDATE "player_profiles"
SET "gardenUnlockedSlotCount" = 7
WHERE "gardenUnlockedSlotCount" < 7;
