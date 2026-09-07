-- AlterTable
ALTER TABLE "territories" ADD COLUMN     "leadId" UUID,
ADD COLUMN     "ownerId" UUID;

-- AddForeignKey
ALTER TABLE "territories" ADD CONSTRAINT "territories_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territories" ADD CONSTRAINT "territories_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
