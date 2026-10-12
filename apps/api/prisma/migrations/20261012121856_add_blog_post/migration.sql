-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('SCHEDULED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dek" TEXT NOT NULL,
    "roomType" "RoomType" NOT NULL,
    "style" "DesignStyle" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT NOT NULL,
    "problems" JSONB NOT NULL,
    "palette" TEXT NOT NULL,
    "materials" TEXT NOT NULL,
    "lighting" TEXT NOT NULL,
    "priceTable" JSONB NOT NULL,
    "faq" JSONB NOT NULL,
    "sourceImageKey" TEXT NOT NULL,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_sourceImageKey_key" ON "BlogPost"("sourceImageKey");

-- CreateIndex
CREATE INDEX "BlogPost_status_idx" ON "BlogPost"("status");
