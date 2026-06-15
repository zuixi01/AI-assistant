import { Controller, Post, Get, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ChatGptOnCsService } from './chatgpt-on-cs.service';
import { ChatGptOnCsMessageDto, ChatGptOnCsAccountDto } from './dto/chatgpt-on-cs.dto';

@Controller('integrations/chatgpt-on-cs')
export class ChatGptOnCsController {
  constructor(private readonly service: ChatGptOnCsService) {}

  // ─── Webhook Endpoint (no JWT — called by ChatGPT-On-CS sidecar) ───

  @Post('message')
  @HttpCode(HttpStatus.OK)
  async receiveMessage(@Body() body: ChatGptOnCsMessageDto) {
    return this.service.handleMessage(body);
  }

  // ─── Admin Endpoints (JWT required) ───

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus() {
    return this.service.getPlatformStatus();
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  async getAccounts(@Req() req: any, @Query('platform') platform?: string) {
    const tenantId = req.user?.tenantId;
    return this.service.getAccounts(tenantId, platform);
  }

  @Post('accounts')
  @UseGuards(JwtAuthGuard)
  async bindAccount(@Req() req: any, @Body() body: ChatGptOnCsAccountDto) {
    const tenantId = req.user?.tenantId;
    return this.service.handleBindAccount(tenantId, body);
  }

  @Post('accounts/:id')
  @UseGuards(JwtAuthGuard)
  async updateAccount(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const tenantId = req.user?.tenantId;
    return this.service.updateAccount(id, tenantId, body);
  }

  @Post('accounts/:id/unbind')
  @UseGuards(JwtAuthGuard)
  async unbindAccount(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId;
    const accounts = await this.service.getAccounts(tenantId);
    const account = accounts.find(a => a.id === id);
    if (!account) return { success: false, error: 'Account not found' };
    return this.service.unbindAccount(tenantId, account.platform, account.platformUserId);
  }

  @Post('accounts/:id/delete')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId;
    return this.service.deleteAccount(id, tenantId);
  }
}
