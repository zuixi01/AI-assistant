import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PipelineService } from './pipeline.service';
import { KNOWLEDGE_INDEX_QUEUE } from './knowledge-index-queue.service';

@Injectable()
@Processor(KNOWLEDGE_INDEX_QUEUE)
export class KnowledgeIndexProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeIndexProcessor.name);

  constructor(private readonly pipeline: PipelineService) {
    super();
  }

  async process(job: Job<{ sourceId: string }>) {
    this.logger.log(`Indexing knowledge source ${job.data.sourceId}`);
    return this.pipeline.processDocument(job.data.sourceId);
  }
}
