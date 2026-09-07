import 'dotenv/config';
import pino from 'pino';
import { Redis } from 'ioredis';
import { createPrismaClient, type PrismaClient } from '@jolo/database';
import { loadServerEnv, type ServerEnv } from '@jolo/config/server';
import { createAiProvider, type AiProvider } from '@jolo/ai-sdr';
import { WhatsAppClient } from '@jolo/whatsapp';

export interface WorkerContext {
  env: ServerEnv;
  prisma: PrismaClient;
  redis: Redis;
  logger: pino.Logger;
  ai: AiProvider;
  whatsapp: WhatsAppClient | null;
}

export function createContext(): WorkerContext {
  const env = loadServerEnv();
  const logger = pino({ level: env.LOG_LEVEL, base: { app: 'jolo-workers' } });
  const prisma = createPrismaClient(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const ai = createAiProvider(env);

  // Sem credencial da Meta o worker continua vivo: apenas nao envia.
  const whatsapp =
    env.META_WHATSAPP_ACCESS_TOKEN && env.META_WHATSAPP_PHONE_NUMBER_ID
      ? new WhatsAppClient({
          accessToken: env.META_WHATSAPP_ACCESS_TOKEN,
          phoneNumberId: env.META_WHATSAPP_PHONE_NUMBER_ID,
          graphVersion: env.META_GRAPH_VERSION,
        })
      : null;

  return { env, prisma, redis, logger, ai, whatsapp };
}
