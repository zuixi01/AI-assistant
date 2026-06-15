import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { DoudianService } from './doudian.service';

@ApiTags('admin/integrations/doudian')
@Controller('admin/integrations/doudian')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DoudianController {
  constructor(private readonly service: DoudianService) {}

  @Post('sync-products')
  syncProducts(@Request() req: any) {
    return this.service.syncProducts(req.user.tenantId);
  }
}
