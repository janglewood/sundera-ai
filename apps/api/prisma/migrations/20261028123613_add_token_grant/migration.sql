-- CreateTable
CREATE TABLE "TokenGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenGrant_userId_idx" ON "TokenGrant"("userId");

-- AddForeignKey
ALTER TABLE "TokenGrant" ADD CONSTRAINT "TokenGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
