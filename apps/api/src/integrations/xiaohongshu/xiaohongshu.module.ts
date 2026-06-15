import { Module } from '@nestjs/common';
import { XiaohongshuService } from './xiaohongshu.service';
import { XiaohongshuWebhookController, XiaohongshuOpenImController, XiaohongshuAdminController, XiaohongshuOAuthController } from './xiaohongshu.controller';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { XhsApiClient } from './xhs-api.client';
import { XhsCrypto } from './xhs-crypto';
import { ChatModule } from '../../chat/chat.module';
import { ConversationsModule } from '../../conversations/conversations.module';
import { LeadsModule } from '../../leads/leads.module';

@Module({
  imports: [ChatModule, ConversationsModule, LeadsModule],
  controllers: [XiaohongshuWebhookController, XiaohongshuOpenImController, XiaohongshuAdminController, XiaohongshuOAuthController, SetupController],
  providers: [XiaohongshuService, XhsApiClient, XhsCrypto, SetupService],
  exports: [XiaohongshuService],
})
export class XiaohongshuModule {}
