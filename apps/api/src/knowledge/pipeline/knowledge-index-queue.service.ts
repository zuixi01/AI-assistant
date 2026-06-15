import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

export const KNOWLEDGE_INDEX_QUEUE = 'knowledge-index';
export const KNOWLEDGE_INDEX_JOB = 'index-source';

@Injectable()
export class KnowledgeIndexQueueService {
  constructor(@InjectQueue(KNOWLEDGE_INDEX_QUEUE) private readonly queue: Queue) {}

  enqueueSourceIndex(sourceId: string) {
    return this.queue.add(
      KNOWLEDGE_INDEX_JOB,
      { sourceId },
      {
        jobId: `${sourceId}:index`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }
}
