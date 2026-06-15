import { Body, Controller, Headers, MessageEvent, Post, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable, Subscriber } from 'rxjs';
import { ChatService } from './chat.service';
import { ConversationsService, PUBLIC_CONVERSATION_TOKEN_HEADER } from '../conversations/conversations.service';
import { ChatRequestDto } from './dto/chat.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private conversationsService: ConversationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'AI 对话' })
  async chat(@Body() body: ChatRequestDto, @Headers(PUBLIC_CONVERSATION_TOKEN_HEADER) publicToken: string) {
    const conversation = await this.conversationsService.findPublicSession(
      body.conversationId,
      body.conversationToken || publicToken,
    );
    return this.chatService.chat({
      conversationId: body.conversationId,
      tenantId: conversation.tenantId,
      userMessage: body.message,
    });
  }

  @Post('stream')
  @ApiOperation({ summary: 'AI 流式对话' })
  @Sse()
  async chatStream(
    @Body() body: ChatRequestDto,
    @Headers(PUBLIC_CONVERSATION_TOKEN_HEADER) publicToken: string,
  ): Promise<Observable<MessageEvent>> {
    const conversation = await this.conversationsService.findPublicSession(
      body.conversationId,
      body.conversationToken || publicToken,
    );

    return new Observable((subscriber: Subscriber<MessageEvent>) => {
      const run = async () => {
        try {
          const stream = this.chatService.chatStream({
            conversationId: body.conversationId,
            tenantId: conversation.tenantId,
            userMessage: body.message,
          });

          for await (const chunk of stream) {
            subscriber.next({ data: chunk } as MessageEvent);
          }
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      };
      run();
    });
  }
}
