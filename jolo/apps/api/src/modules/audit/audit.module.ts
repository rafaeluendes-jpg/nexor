import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { AuditController } from './audit.controller.js';

@Module({ controllers: [AuditController], providers: [PrismaService] })
export class AuditModule {}
