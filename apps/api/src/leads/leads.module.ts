import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController, AdminLeadsController } from './leads.controller';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [ConversationsModule],
  controllers: [LeadsController, AdminLeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
