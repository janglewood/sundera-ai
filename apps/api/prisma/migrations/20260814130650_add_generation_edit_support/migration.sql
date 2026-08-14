-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "sourceResultId" TEXT;

-- CreateIndex
CREATE INDEX "Generation_sourceResultId_idx" ON "Generation"("sourceResultId");

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_sourceResultId_fkey" FOREIGN KEY ("sourceResultId") REFERENCES "GenerationResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
