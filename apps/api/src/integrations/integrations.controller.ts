import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  @Get('status')
  @ApiOperation({ summary: '获取集成状态' })
  getStatus() {
    return {
      doudian: { connected: false, mode: 'mock' },
      douyinMiniapp: { connected: false },
      wechatMiniapp: { connected: false },
    };
  }
}
