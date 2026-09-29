import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { TermoController } from './termo.controller.js';
import { TermoService } from './termo.service.js';

@Global()
@Module({
  controllers: [TermoController],
  providers: [TermoService, PrismaService],
  exports: [TermoService],
})
export class TermoModule {}
