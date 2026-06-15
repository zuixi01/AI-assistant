import { describe, expect, it } from 'vitest';
import { tokenizeRetrievalQuery } from '../../apps/api/src/knowledge/retrieval/query-tokenizer';

describe('retrieval query tokenizer', () => {
  it('extracts useful Chinese and alphanumeric terms from ecommerce questions', () => {
    const tokens = tokenizeRetrievalQuery('泰国金枕榴莲多少钱？3-4斤还有库存吗');

    expect(tokens).toContain('泰国金枕榴莲');
    expect(tokens).toContain('多少钱');
    expect(tokens).toContain('库存');
    expect(tokens).toContain('3-4斤');
  });
});
