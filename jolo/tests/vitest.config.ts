import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const raiz = (caminho: string): string => fileURLToPath(new URL(caminho, import.meta.url));
// biblioteca instalada so nos workers: o teste precisa enxergar a mesma copia para substitui-la
const dosWorkers = createRequire(raiz('../workers/package.json'));

export default defineConfig({
  resolve: {
    alias: {
      '@jolo/shared': raiz('../packages/shared/src/index.ts'),
      '@jolo/security': raiz('../packages/security/src/index.ts'),
      '@jolo/whatsapp': raiz('../packages/whatsapp/src/index.ts'),
      '@jolo/crm-core': raiz('../packages/crm-core/src/index.ts'),
      '@jolo/attribution': raiz('../packages/attribution/src/index.ts'),
      '@jolo/analytics': raiz('../packages/analytics/src/index.ts'),
      '@jolo/config/server': raiz('../packages/config/src/server.ts'),
      '@jolo/config': raiz('../packages/config/src/index.ts'),
      'web-push': dosWorkers.resolve('web-push'),
    },
  },
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
    reporters: 'verbose',
  },
});
