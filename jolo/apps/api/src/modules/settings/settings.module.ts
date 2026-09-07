import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { SettingsController } from './settings.controller.js';
import { ScoreRulesController } from './score-rules.controller.js';

@Module({ controllers: [SettingsController, ScoreRulesController], providers: [PrismaService] })
export class SettingsModule {}
