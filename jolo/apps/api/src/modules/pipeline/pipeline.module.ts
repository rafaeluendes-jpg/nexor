import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { PipelineController } from './pipeline.controller.js';

@Module({ controllers: [PipelineController], providers: [PrismaService] })
export class PipelineModule {}
