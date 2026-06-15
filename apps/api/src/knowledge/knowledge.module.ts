import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { ParserFactory } from './parsers/parser.factory';
import { ChunkerFactory } from './chunkers/chunker.factory';
import { RetrievalService } from './retrieval/retrieval.service';
import { PipelineService } from './pipeline/pipeline.service';
import { DocumentParserService } from './services/document-parser.service';
import { VectorStoreService } from './services/vector-store.service';
import { KnowledgeGraphService } from './services/knowledge-graph.service';
import { CustomerServiceRAGService } from './services/customer-service-rag.service';
import { PythonSidecarClient } from './services/python-sidecar.client';
import { VectorAcceleratorClient } from './services/vector-accelerator.client';
import { AiModule } from '../ai/ai.module';
import { KnowledgeIndexProcessor } from './pipeline/knowledge-index.processor';
import { KNOWLEDGE_INDEX_QUEUE, KnowledgeIndexQueueService } from './pipeline/knowledge-index-queue.service';
import { KnowledgeEnhancementsModule } from './enhancements/knowledge-enhancements.module';

@Module({
  imports: [
    AiModule,
    KnowledgeEnhancementsModule,
    BullModule.registerQueue({ name: KNOWLEDGE_INDEX_QUEUE }),
  ],
  controllers: [KnowledgeController],
  providers: [
    ParserFactory,
    ChunkerFactory,
    RetrievalService,
    PipelineService,
    KnowledgeService,
    DocumentParserService,
    VectorStoreService,
    KnowledgeGraphService,
    CustomerServiceRAGService,
    PythonSidecarClient,
    VectorAcceleratorClient,
    KnowledgeIndexQueueService,
    KnowledgeIndexProcessor,
  ],
  exports: [
    KnowledgeService,
    RetrievalService,
  ],
})
export class KnowledgeModule {}
