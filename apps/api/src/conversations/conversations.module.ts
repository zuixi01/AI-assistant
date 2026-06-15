import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController, AdminConversationsController } from './conversations.controller';
import { TenantsModule } from '../tenants/tenants.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [TenantsModule, WorkspaceModule],
  controllers: [ConversationsController, AdminConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
