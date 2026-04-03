-- Step 1: Add email column as nullable
ALTER TABLE "User" ADD COLUMN "email" TEXT;

-- Step 2: Generate emails for existing users from username if email is NULL
UPDATE "User" SET "email" = username || '@trackpay.local' WHERE "email" IS NULL;

-- Step 3: Make email NOT NULL and UNIQUE
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");

-- Step 4: Add avatar column (optional)
ALTER TABLE "User" ADD COLUMN "avatar" TEXT;

-- Step 5: Add appleId column for Apple Authentication
ALTER TABLE "User" ADD COLUMN "appleId" TEXT UNIQUE;

-- Step 6: Drop the old password NOT NULL constraint to allow optional password for Apple users
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- Step 7: Add index for customerId, date on Purchase table
CREATE INDEX "Purchase_customerId_date_idx" ON "Purchase"("customerId", "date");
