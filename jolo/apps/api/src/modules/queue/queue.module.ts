import { Global, Module } from '@nestjs/common';
import { RedisService } from '../../common/redis.service.js';
import { QueueService } from './queue.service.js';

@Global()
@Module({ providers: [QueueService, RedisService], exports: [QueueService] })
export class QueueModule {}
