import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { LeadsController } from './leads.controller.js';
import { LeadsService } from './leads.service.js';

@Module({ controllers: [LeadsController], providers: [LeadsService, PrismaService] })
export class LeadsModule {}
