import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { ReportsController } from './reports.controller.js';

@Module({ controllers: [ReportsController], providers: [PrismaService] })
export class ReportsModule {}
