import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const raiz = (caminho: string): string => fileURLToPath(new URL(caminho, import.meta.url));

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
    },
  },
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
    reporters: 'verbose',
  },
});
