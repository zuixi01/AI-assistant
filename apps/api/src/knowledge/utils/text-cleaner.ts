/**
 * Text cleaning utility for knowledge base content.
 * Follows rules from the RAG development doc section 10.
 */

/** Characters/symbols to normalize */
const NORMALIZE_MAP: Record<string, string> = {
  '‘': "'", // left single quote
  '’': "'", // right single quote
  '“': '"', // left double quote
  '”': '"', // right double quote
  '–': '-', // en dash
  '—': '-', // em dash
  ' ': ' ', // non-breaking space
  '　': ' ', // ideographic space
  '…': '...', // ellipsis
};

export function cleanText(raw: string): string {
  if (!raw) return '';

  let text = raw;

  // 1. Normalize unicode characters
  for (const [from, to] of Object.entries(NORMALIZE_MAP)) {
    text = text.split(from).join(to);
  }

  // 2. Remove control characters (except newline, tab, carriage return)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 3. Collapse multiple spaces (not newlines)
  text = text.replace(/ {2,}/g, ' ');

  // 4. Collapse multiple blank lines to max 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // 5. Trim each line's trailing whitespace
  text = text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');

  // 6. Trim overall
  text = text.trim();

  return text;
}

/**
 * Extract keywords from text for better search.
 * Simple approach: split by punctuation and common stop words.
 */
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'this', 'that',
]);

export function extractKeywords(text: string, maxKeywords = 10): string[] {
  // Split on whitespace and punctuation, filter stop words and very short tokens
  const tokens = text
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  // Count frequency
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }

  // Sort by frequency and return top N
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}
