import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { TemplatesController } from './templates.controller.js';

@Module({ controllers: [TemplatesController], providers: [PrismaService] })
export class TemplatesModule {}
