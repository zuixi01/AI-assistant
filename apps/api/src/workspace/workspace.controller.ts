import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceService } from './workspace.service';
import { Response } from 'express';

@ApiTags('admin/workspace')
@Controller('admin/workspace')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  @Get('conversations')
  getConversations(@Req() req: any, @Query() query: any) {
    return this.service.getConversations(req.user.tenantId, {
      channel: query.channel,
      status: query.status,
      assignedTo: query.assignedTo,
      search: query.search,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 50,
    });
  }

  @Get('conversations/:id/messages')
  getMessages(@Req() req: any, @Param('id') id: string, @Query('limit') limit?: string) {
    return this.service.getMessages(id, req.user.tenantId, limit ? parseInt(limit) : undefined);
  }

  @Post('conversations/:id/assign')
  assign(@Req() req: any, @Param('id') id: string, @Body() body: { assignedTo: string }) {
    return this.service.assignConversation(id, req.user.tenantId, body.assignedTo);
  }

  @Post('conversations/:id/unassign')
  unassign(@Req() req: any, @Param('id') id: string) {
    return this.service.unassignConversation(id, req.user.tenantId);
  }

  @Patch('conversations/:id/assignment')
  updateAssignment(@Req() req: any, @Param('id') id: string, @Body() body: { assignedTo?: string | null }) {
    if (body.assignedTo) {
      return this.service.assignConversation(id, req.user.tenantId, body.assignedTo);
    }
    return this.service.unassignConversation(id, req.user.tenantId);
  }

  @Post('conversations/:id/status')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.service.updateStatus(id, req.user.tenantId, body.status);
  }

  @Patch('conversations/:id/status')
  patchStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.service.updateStatus(id, req.user.tenantId, body.status);
  }

  @Post('conversations/:id/reply')
  sendReply(@Req() req: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.service.sendManualReply(id, req.user.tenantId, body.content, req.user.id);
  }

  @Get('stats')
  getStats(@Req() req: any) {
    return this.service.getStats(req.user.tenantId);
  }

  @Get('export')
  async exportConversations(@Req() req: any, @Query() query: any, @Res() res: Response) {
    const format = query.format || 'json';
    const data = await this.service.exportConversations(req.user.tenantId, {
      channel: query.channel,
      startDate: query.startDate,
      endDate: query.endDate,
      format,
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=conversations.csv');
      res.send(data);
    } else {
      res.json(data);
    }
  }
}
