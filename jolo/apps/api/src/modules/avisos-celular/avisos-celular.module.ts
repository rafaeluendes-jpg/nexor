import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { AvisosCelularController } from './avisos-celular.controller.js';

@Module({
  controllers: [AvisosCelularController],
  providers: [PrismaService],
})
export class AvisosCelularModule {}
