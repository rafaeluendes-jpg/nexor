import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { RedisService } from '../../common/redis.service.js';
import { AvisosService } from '../../common/avisos.service.js';
import { LeadsController } from './leads.controller.js';
import { LeadsService } from './leads.service.js';

@Module({ controllers: [LeadsController], providers: [LeadsService, PrismaService, AvisosService, RedisService] })
export class LeadsModule {}
