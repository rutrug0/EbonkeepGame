-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_username_key" ON "accounts"("username");

-- CreateIndex
CREATE INDEX "accounts_username_idx" ON "accounts"("username");
