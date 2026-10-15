-- Replace the single LIFETIME plan tier with three stackable one-time packs
-- (ROOM / ROOMS / HOUSE). Legacy LIFETIME purchases map to ROOMS (the closest
-- equivalent token grant) so existing paying users keep their entitlement.

-- AlterEnum
BEGIN;
CREATE TYPE "PlanTier_new" AS ENUM ('ROOM', 'ROOMS', 'HOUSE');
ALTER TABLE "Purchase" ALTER COLUMN "planTier" TYPE "PlanTier_new" USING (
  (CASE "planTier"::text WHEN 'LIFETIME' THEN 'ROOMS' ELSE "planTier"::text END)::"PlanTier_new"
);
ALTER TYPE "PlanTier" RENAME TO "PlanTier_old";
ALTER TYPE "PlanTier_new" RENAME TO "PlanTier";
DROP TYPE "public"."PlanTier_old";
COMMIT;

-- DropIndex
DROP INDEX "Purchase_userId_key";

-- CreateIndex
CREATE INDEX "Purchase_userId_idx" ON "Purchase"("userId");
