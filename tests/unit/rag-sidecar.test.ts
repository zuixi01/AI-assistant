import { describe, expect, it, vi } from 'vitest';
import { DocumentParserService } from '../../apps/api/src/knowledge/services/document-parser.service';

describe('document parser sidecar integration', () => {
  it('uses the Python sidecar before local parsers when the sidecar is enabled and succeeds', async () => {
    const parserFactory = {
      parse: vi.fn().mockResolvedValue({ content: 'local text', sections: [], metadata: {} }),
      getParser: vi.fn().mockReturnValue({}),
    };
    const prisma = { knowledgeSource: { update: vi.fn().mockResolvedValue({}) } };
    const sidecar = {
      isEnabled: true,
      parseDocument: vi.fn().mockResolvedValue({
        success: true,
        fullText: 'sidecar text',
        sections: [{ type: 'text', content: 'sidecar text', sectionIndex: 0 }],
        metadata: { parser: 'sidecar' },
        parseDurationMs: 42,
      }),
    };
    const service = new (DocumentParserService as any)(parserFactory, prisma, sidecar);

    const result = await service.parseDocument('source-1', Buffer.from('doc'), 'doc.pdf', {
      extractTables: true,
      extractImages: true,
    });

    expect(result.fullText).toBe('sidecar text');
    expect(sidecar.parseDocument).toHaveBeenCalledOnce();
    expect(parserFactory.parse).not.toHaveBeenCalled();
  });
});
