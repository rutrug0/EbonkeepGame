-- Replace gender column with portraitId
ALTER TABLE "player_profiles" RENAME COLUMN "gender" TO "portraitId";
ALTER TABLE "player_profiles" ALTER COLUMN "portraitId" DROP DEFAULT;
UPDATE "player_profiles" SET "portraitId" = 'portrait_01';
ALTER TABLE "player_profiles" ALTER COLUMN "portraitId" SET DEFAULT 'portrait_01';
