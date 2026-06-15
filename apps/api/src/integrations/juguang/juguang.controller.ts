import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JuguangService } from './juguang.service';
import { JuguangWebhookDto, JuguangBindAccountDto, JuguangSendMessageDto } from './dto/juguang.dto';

// Webhook Endpoints (no JWT - called by Juguang servers)

@ApiTags('webhooks/juguang')
@Controller('webhooks/juguang')
export class JuguangWebhookController {
  constructor(private readonly juguangService: JuguangService) {}

  @Post('event')
  async handleEvent(@Body() body: any) {
    return this.juguangService.handleWebhook(body);
  }

  @Post('im/send')
  async handleImSend(@Body() body: any) {
    return this.juguangService.handleMessage(body);
  }

  @Post('lead/data')
  async handleLeadData(@Body() body: any) {
    return this.juguangService.handleLeadData(body);
  }
}

// Admin Endpoints (JWT protected)

@ApiTags('admin/integrations/juguang')
@Controller('admin/integrations/juguang')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JuguangAdminController {
  constructor(private readonly juguangService: JuguangService) {}

  @Get('accounts')
  async getAccounts(@Req() req: any) {
    return this.juguangService.getAccounts(req.user.tenantId);
  }

  @Get('accounts/:id')
  async getAccount(@Req() req: any, @Param('id') id: string) {
    return this.juguangService.getAccount(id, req.user.tenantId);
  }

  @Post('accounts')
  async createAccount(@Req() req: any, @Body() body: JuguangBindAccountDto) {
    return this.juguangService.createAccount(req.user.tenantId, body);
  }

  @Patch('accounts/:id')
  async updateAccount(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.juguangService.updateAccount(id, req.user.tenantId, body);
  }

  @Delete('accounts/:id')
  async deleteAccount(@Req() req: any, @Param('id') id: string) {
    return this.juguangService.deleteAccount(id, req.user.tenantId);
  }

  @Post('accounts/:id/refresh-token')
  async refreshToken(@Req() req: any, @Param('id') id: string) {
    return this.juguangService.refreshToken(id, req.user.tenantId);
  }
}
