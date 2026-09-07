import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { MeetingsController } from './meetings.controller.js';
import { MeetingsService } from './meetings.service.js';

@Module({ controllers: [MeetingsController], providers: [MeetingsService, PrismaService] })
export class MeetingsModule {}
