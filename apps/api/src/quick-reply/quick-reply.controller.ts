import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuickReplyService } from './quick-reply.service';

@ApiTags('admin/quick-replies')
@Controller('admin/quick-replies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuickReplyController {
  constructor(private readonly service: QuickReplyService) {}

  @Get()
  findAll(@Req() req: any, @Query('category') category?: string) {
    return this.service.findAll(req.user.tenantId, category);
  }

  @Get('categories')
  getCategories(@Req() req: any) {
    return this.service.getCategories(req.user.tenantId);
  }

  @Get('search')
  search(@Req() req: any, @Query('q') query: string) {
    return this.service.search(req.user.tenantId, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(id, req.user.tenantId);
  }

  @Post()
  create(@Req() req: any, @Body() body: { title: string; content: string; category?: string; sortOrder?: number }) {
    return this.service.create(req.user.tenantId, body);
  }

  @Post('batch')
  batchCreate(@Req() req: any, @Body() body: { items: { title: string; content: string; category?: string }[] }) {
    return this.service.batchCreate(req.user.tenantId, body.items);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string; content?: string; category?: string; sortOrder?: number }) {
    return this.service.update(id, req.user.tenantId, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.service.delete(id, req.user.tenantId);
  }

  @Post(':id/use')
  incrementUsage(@Param('id') id: string) {
    return this.service.incrementUsage(id);
  }
}
