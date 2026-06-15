import { Controller, Get, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UnknownQuestionsService } from './unknown-questions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('admin/unknown-questions')
@Controller('admin/unknown-questions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UnknownQuestionsController {
  constructor(private unknownQuestionsService: UnknownQuestionsService) {}

  @Get()
  @ApiOperation({ summary: '获取无法回答问题列表' })
  findAll(
    @Request() req,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('resolved') resolved?: string,
  ) {
    return this.unknownQuestionsService.findByTenant(
      req.user.tenantId,
      +page,
      +pageSize,
      resolved ? resolved === 'true' : undefined,
    );
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: '标记问题已解决' })
  resolve(@Request() req, @Param('id') id: string, @Body() body: { suggestion?: string }) {
    return this.unknownQuestionsService.resolve(req.user.tenantId, id, body.suggestion);
  }
}
