import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { ContactsController } from './contacts.controller.js';

@Module({ controllers: [ContactsController], providers: [PrismaService] })
export class ContactsModule {}
