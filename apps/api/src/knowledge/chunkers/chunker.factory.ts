import { Injectable } from '@nestjs/common';
import { TextChunker, ChunkOptions } from './chunker.interface';
import { FixedSizeChunker } from './fixed-size.chunker';
import { RecursiveChunker } from './recursive.chunker';
import { QAPairChunker } from './qa-pair.chunker';
import { Chunk } from './chunker.interface';

@Injectable()
export class ChunkerFactory {
  private chunkers = new Map<string, TextChunker>([
    ['fixed-size', new FixedSizeChunker()],
    ['recursive', new RecursiveChunker()],
    ['qa-pair', new QAPairChunker()],
  ]);

  getChunker(name?: string): TextChunker {
    const chunkerName = name || 'recursive';
    const chunker = this.chunkers.get(chunkerName);
    if (!chunker) {
      throw new Error(`Chunker "${chunkerName}" not found. Available: ${[...this.chunkers.keys()].join(', ')}`);
    }
    return chunker;
  }

  chunk(text: string, strategy?: string, options?: ChunkOptions): Chunk[] {
    return this.getChunker(strategy).chunk(text, options);
  }
}
