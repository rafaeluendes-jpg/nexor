import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { IntegrationsController } from './integrations.controller.js';

@Module({ controllers: [IntegrationsController], providers: [PrismaService] })
export class IntegrationsModule {}
