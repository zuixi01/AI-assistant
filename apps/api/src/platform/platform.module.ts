import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { ReplyStrategyModule } from '../reply-strategy/reply-strategy.module';
import { PlatformRouterService } from './platform-router.service';
import { MessageAdapterService } from './message-adapter.service';
import { PlatformMonitorService } from './platform-monitor.service';

@Module({
  imports: [PrismaModule, ChatModule, ConversationsModule, ReplyStrategyModule],
  providers: [PlatformRouterService, MessageAdapterService, PlatformMonitorService],
  exports: [PlatformRouterService, MessageAdapterService, PlatformMonitorService],
})
export class PlatformModule {}
