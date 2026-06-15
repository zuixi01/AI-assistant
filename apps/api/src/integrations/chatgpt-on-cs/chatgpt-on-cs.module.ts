import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ChatModule } from '../../chat/chat.module';
import { ConversationsModule } from '../../conversations/conversations.module';
import { LeadsModule } from '../../leads/leads.module';
import { PlatformModule } from '../../platform/platform.module';
import { ChatGptOnCsController } from './chatgpt-on-cs.controller';
import { ChatGptOnCsService } from './chatgpt-on-cs.service';

@Module({
  imports: [PrismaModule, ChatModule, ConversationsModule, LeadsModule, PlatformModule],
  controllers: [ChatGptOnCsController],
  providers: [ChatGptOnCsService],
  exports: [ChatGptOnCsService],
})
export class ChatGptOnCsModule {}
