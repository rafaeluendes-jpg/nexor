import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { CofController } from './cof.controller.js';
import { CofService } from './cof.service.js';

@Module({ controllers: [CofController], providers: [CofService, PrismaService] })
export class CofModule {}
