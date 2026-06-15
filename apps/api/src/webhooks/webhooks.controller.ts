import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post('doudian')
  @ApiOperation({ summary: '抖店 Webhook 回调' })
  handleDoudian(@Body() body: any, @Headers('x-webhook-signature') signature?: string) {
    return this.webhooksService.processDoudianEvent(body, signature);
  }
}
