import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ModelConfigService, ModelConfig, ProviderConfig } from './model-config.service';

@ApiTags('model-config')
@Controller('model-config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ModelConfigController {
  constructor(private modelConfigService: ModelConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get current model configuration' })
  async getConfig(@Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.modelConfigService.getConfig(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Save model configuration' })
  async saveConfig(@Request() req: any, @Body() body: ModelConfig) {
    const tenantId = req.user.tenantId;
    return this.modelConfigService.saveConfig(tenantId, body);
  }

  @Post('test-llm')
  @ApiOperation({ summary: 'Test LLM connection' })
  async testLlm(@Body() body: ProviderConfig) {
    return this.modelConfigService.testLlmConnection(body);
  }

  @Post('test-embedding')
  @ApiOperation({ summary: 'Test Embedding connection' })
  async testEmbedding(@Body() body: ProviderConfig) {
    return this.modelConfigService.testEmbeddingConnection(body);
  }
}
