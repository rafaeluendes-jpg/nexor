import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PrismaService } from './common/prisma.service.js';
import { RedisService } from './common/redis.service.js';
import { RequestContextMiddleware } from './common/request-context.js';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';
import { RateLimitGuard } from './common/guards/rate-limit.guard.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AttributionModule } from './modules/attribution/attribution.module.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';
import { ConversationsModule } from './modules/conversations/conversations.module.js';
import { LeadsModule } from './modules/leads/leads.module.js';
import { PipelineModule } from './modules/pipeline/pipeline.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { ExcelModule } from './modules/excel/excel.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    UsersModule,
    AttributionModule,
    WebhooksModule,
    ConversationsModule,
    LeadsModule,
    PipelineModule,
    DashboardModule,
    ExcelModule,
    QueueModule,
  ],
  providers: [
    PrismaService,
    RedisService,
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    // Ordem importa: limite -> autenticacao -> permissao.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [PrismaService, RedisService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
