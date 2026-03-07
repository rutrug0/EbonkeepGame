-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "emailVerifyToken" TEXT,
ADD COLUMN     "emailVerifyExpiry" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT,
ADD COLUMN     "resetPasswordExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_emailVerifyToken_key" ON "accounts"("emailVerifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_resetPasswordToken_key" ON "accounts"("resetPasswordToken");

-- CreateIndex
CREATE INDEX "accounts_emailVerifyToken_idx" ON "accounts"("emailVerifyToken");

-- CreateIndex
CREATE INDEX "accounts_resetPasswordToken_idx" ON "accounts"("resetPasswordToken");
