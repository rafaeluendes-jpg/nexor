import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { MetaWebhookController } from './meta.controller.js';

@Module({ controllers: [MetaWebhookController], providers: [PrismaService] })
export class WebhooksModule {}
