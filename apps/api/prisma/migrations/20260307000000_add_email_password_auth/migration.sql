-- Add email and password authentication fields to accounts table
ALTER TABLE "accounts"
ADD COLUMN "email" TEXT,
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Create unique index on email
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- Create index for faster email lookups
CREATE INDEX "accounts_email_idx" ON "accounts"("email");
