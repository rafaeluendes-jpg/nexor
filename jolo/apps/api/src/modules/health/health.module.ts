import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { RedisService } from '../../common/redis.service.js';
import { HealthController } from './health.controller.js';

@Module({ controllers: [HealthController], providers: [PrismaService, RedisService] })
export class HealthModule {}
