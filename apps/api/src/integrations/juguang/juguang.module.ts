import { Module } from '@nestjs/common';
import { JuguangService } from './juguang.service';
import { JuguangWebhookController, JuguangAdminController } from './juguang.controller';
import { ChatModule } from '../../chat/chat.module';
import { ConversationsModule } from '../../conversations/conversations.module';
import { LeadsModule } from '../../leads/leads.module';
import { PlatformModule } from '../../platform/platform.module';

@Module({
  imports: [ChatModule, ConversationsModule, LeadsModule, PlatformModule],
  controllers: [JuguangWebhookController, JuguangAdminController],
  providers: [JuguangService],
  exports: [JuguangService],
})
export class JuguangModule {}
