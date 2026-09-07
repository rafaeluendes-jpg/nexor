export * from '@prisma/client';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __joloPrisma: PrismaClient | undefined;
}

export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL nao configurada. Veja .env.example.');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter, log: ['warn', 'error'] });
}

/** Cliente unico por processo (evita esgotar conexoes em hot-reload). */
export function getPrisma(): PrismaClient {
  if (!globalThis.__joloPrisma) {
    globalThis.__joloPrisma = createPrismaClient();
  }
  return globalThis.__joloPrisma;
}
