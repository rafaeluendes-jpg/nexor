import pino from 'pino';
import { redact } from '@jolo/security';

/** Log estruturado com request_id e correlation_id (item 47). Sem segredo. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { app: 'jolo-api' },
  formatters: { level: (label) => ({ level: label }) },
  hooks: {
    logMethod(args, method) {
      const [primeiro, ...resto] = args;
      if (primeiro && typeof primeiro === 'object') {
        return method.apply(this, [redact(primeiro), ...resto] as never);
      }
      return method.apply(this, args as never);
    },
  },
});
