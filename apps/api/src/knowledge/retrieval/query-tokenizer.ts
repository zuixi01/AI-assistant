const BUSINESS_TERMS = [
  '多少钱',
  '价格',
  '库存',
  '发货',
  '物流',
  '退货',
  '换货',
  '优惠',
  '订单',
  '规格',
  '保修',
  '发票',
  '推荐',
  '榴莲',
];

function unique(tokens: string[]): string[] {
  return [...new Set(tokens.map((t) => t.trim()).filter((t) => t.length >= 2))];
}

export function tokenizeRetrievalQuery(query: string, maxTokens = 16): string[] {
  const normalized = query.trim();
  if (!normalized) return [];

  const tokens: string[] = [];
  const alphaNumeric = normalized.match(/[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*/g) || [];
  tokens.push(...alphaNumeric);

  const quantityTerms = normalized.match(/\d+(?:-\d+)?\s*(?:斤|kg|g|件|箱|瓶|元)/gi) || [];
  tokens.push(...quantityTerms.map((t) => t.replace(/\s+/g, '')));

  for (const term of BUSINESS_TERMS) {
    if (normalized.includes(term)) tokens.push(term);
  }

  const cjkRuns = normalized.match(/[\u4e00-\u9fff]{2,}/g) || [];
  for (const run of cjkRuns) {
    tokens.push(run);
    const withoutQuestionTerms = run.replace(/多少钱|价格|库存|还有|吗|呢|有吗|多少/g, '');
    if (withoutQuestionTerms.length >= 2) tokens.push(withoutQuestionTerms);
    for (let i = 0; i < run.length - 1; i++) {
      tokens.push(run.slice(i, i + 2));
    }
  }

  return unique(tokens)
    .sort((a, b) => b.length - a.length)
    .slice(0, maxTokens);
}
