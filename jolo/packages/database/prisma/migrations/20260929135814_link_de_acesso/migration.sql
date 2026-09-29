-- CreateTable
CREATE TABLE "access_links" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_links_tokenHash_key" ON "access_links"("tokenHash");

-- CreateIndex
CREATE INDEX "access_links_userId_usedAt_idx" ON "access_links"("userId", "usedAt");

-- AddForeignKey
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
