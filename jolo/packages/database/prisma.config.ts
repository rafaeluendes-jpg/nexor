import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7: a URL do banco vive aqui (e no ambiente), nunca dentro do schema.
 * Assim o schema pode ser lido publicamente sem revelar credencial.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
