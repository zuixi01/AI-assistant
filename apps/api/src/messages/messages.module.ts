import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { AdminMessagesController, MessagesController } from './messages.controller';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [ConversationsModule],
  controllers: [MessagesController, AdminMessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
