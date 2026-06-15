import { Module, forwardRef } from '@nestjs/common';
import { LlmService } from './llm/llm.service';
import { LlmProviderFactory } from './llm/llm-provider.factory';
import { EmbeddingService } from './embedding/embedding.service';
import { EmbeddingProviderFactory } from './embedding/embedding-provider.factory';
import { PromptsService } from './prompts/prompts.service';
import { ModelConfigModule } from './model-config/model-config.module';

@Module({
  providers: [
    LlmProviderFactory,
    LlmService,
    EmbeddingProviderFactory,
    EmbeddingService,
    PromptsService,
  ],
  imports: [ModelConfigModule],
  exports: [LlmService, EmbeddingService, PromptsService, ModelConfigModule],
})
export class AiModule {}
