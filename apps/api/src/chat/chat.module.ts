import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AiModule } from '../ai/ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ChatTurnContextService } from './chat-turn-context.service';
import { ChatTurnAuditService } from './chat-turn-audit.service';

@Module({
  imports: [AiModule, KnowledgeModule, MessagesModule, ConversationsModule, TenantsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatTurnContextService, ChatTurnAuditService],
  exports: [ChatService],
})
export class ChatModule {}
