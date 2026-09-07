import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { AttributionController } from './attribution.controller.js';
import { AttributionService } from './attribution.service.js';

@Module({
  controllers: [AttributionController],
  providers: [AttributionService, PrismaService],
  exports: [AttributionService],
})
export class AttributionModule {}
