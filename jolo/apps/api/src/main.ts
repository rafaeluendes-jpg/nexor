import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { corsOrigins, loadServerEnv } from '@jolo/config/server';
import { AppModule } from './app.module.js';
import { logger } from './common/logger.js';

async function bootstrap(): Promise<void> {
  const env = loadServerEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: env.TRUST_PROXY, bodyLimit: 2 * 1024 * 1024 }),
    // rawBody e obrigatorio: a assinatura da Meta e calculada sobre os bytes crus.
    { rawBody: true, bufferLogs: true },
  );

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginEmbedderPolicy: false });
  await app.register(cors, {
    origin: corsOrigins(env),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  // Envio de documento (COF, contrato, ficha). O limite aqui e a ultima trava:
  // o servico ainda confere tipo e tamanho antes de gravar.
  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 10 },
    attachFieldsToBody: false,
  });

  app.enableShutdownHooks();
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'API Jolo no ar');
}

bootstrap().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : err }, 'falha ao subir a API');
  process.exitCode = 1;
});
