import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { ExcelController } from './excel.controller.js';

@Module({ controllers: [ExcelController], providers: [PrismaService] })
export class ExcelModule {}
