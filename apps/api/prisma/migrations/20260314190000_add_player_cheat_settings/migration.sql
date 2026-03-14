ALTER TABLE "player_profiles"
ADD COLUMN "fastTravelEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "invincibilityEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fastTrainTimeEnabled" BOOLEAN NOT NULL DEFAULT false;
