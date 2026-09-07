import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { DashboardController } from './dashboard.controller.js';

@Module({ controllers: [DashboardController], providers: [PrismaService] })
class DashboardModuleClass {}
export { DashboardModuleClass as DashboardModule };
