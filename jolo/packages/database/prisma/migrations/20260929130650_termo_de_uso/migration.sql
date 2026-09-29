-- CreateTable
CREATE TABLE "term_acceptances" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "term_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "term_acceptances_organizationId_acceptedAt_idx" ON "term_acceptances"("organizationId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "term_acceptances_userId_version_key" ON "term_acceptances"("userId", "version");

-- AddForeignKey
ALTER TABLE "term_acceptances" ADD CONSTRAINT "term_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
