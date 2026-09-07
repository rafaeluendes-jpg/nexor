import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { RedisService } from '../../common/redis.service.js';
import { AvisosService } from '../../common/avisos.service.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';

@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService, PrismaService, AvisosService, RedisService],
})
export class ConversationsModule {}
