import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { TerritoriesController } from './territories.controller.js';
import { TerritoriesService } from './territories.service.js';

@Module({ controllers: [TerritoriesController], providers: [TerritoriesService, PrismaService] })
export class TerritoriesModule {}
