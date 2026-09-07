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
import { TasksModule } from './modules/tasks/tasks.module.js';
import { MeetingsModule } from './modules/meetings/meetings.module.js';
import { CofModule } from './modules/cof/cof.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { TerritoriesModule } from './modules/territories/territories.module.js';
import { TemplatesModule } from './modules/templates/templates.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { ContactsModule } from './modules/contacts/contacts.module.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { ImportacaoModule } from './modules/importacao/importacao.module.js';
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
    TasksModule,
    MeetingsModule,
    CofModule,
    DocumentsModule,
    TerritoriesModule,
    TemplatesModule,
    SettingsModule,
    ReportsModule,
    AuditModule,
    ContactsModule,
    IntegrationsModule,
    RealtimeModule,
    ImportacaoModule,
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
