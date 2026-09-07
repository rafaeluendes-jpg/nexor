import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { ImportacaoController } from './importacao.controller.js';
import { ImportacaoService } from './importacao.service.js';

@Module({ controllers: [ImportacaoController], providers: [ImportacaoService, PrismaService] })
export class ImportacaoModule {}
