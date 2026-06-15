import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('module architecture boundaries', () => {
  it('keeps knowledge implementation services internal to KnowledgeModule', () => {
    const knowledgeModule = source('apps/api/src/knowledge/knowledge.module.ts');

    expect(knowledgeModule).toContain('exports: [');
    expect(knowledgeModule).toContain('KnowledgeService');
    expect(knowledgeModule).toContain('RetrievalService');
    expect(knowledgeModule).not.toMatch(/exports:\s*\[[\s\S]*DocumentParserService/);
    expect(knowledgeModule).not.toMatch(/exports:\s*\[[\s\S]*VectorStoreService/);
    expect(knowledgeModule).not.toMatch(/exports:\s*\[[\s\S]*PythonSidecarClient/);
  });

  it('mounts knowledge enhancements through KnowledgeModule instead of the app root', () => {
    const knowledgeModule = source('apps/api/src/knowledge/knowledge.module.ts');
    const appModule = source('apps/api/src/app.module.ts');

    expect(knowledgeModule).toContain('KnowledgeEnhancementsModule');
    expect(appModule).not.toContain('KnowledgeEnhancementsModule');
  });
});
