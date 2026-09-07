import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({ controllers: [DocumentsController], providers: [DocumentsService, PrismaService] })
export class DocumentsModule {}
