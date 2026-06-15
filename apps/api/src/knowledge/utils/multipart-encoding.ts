/**
 * Multer/busboy 常把 UTF-8 文件名与表单字段按 Latin1 读入，出现「乱码」。
 * 将疑似误编码的字符串尝试 Latin1 → UTF-8 还原。
 */
export function decodeMultipartUtf8(value: string | undefined | null): string | undefined {
  if (value == null || value === '') return value ?? undefined;

  const replacementCount = (s: string) => (s.match(/\uFFFD/g) || []).length;

  try {
    const fromLatin1 = Buffer.from(value, 'latin1').toString('utf8');
    if (fromLatin1 === value) return value;

    const origBad = replacementCount(value);
    const decBad = replacementCount(fromLatin1);

    // 解码后替换符更少，或出现合理中文而原文无中文，则采用解码结果
    if (decBad < origBad) return fromLatin1;
    if (/[\u4e00-\u9fff]/.test(fromLatin1) && !/[\u4e00-\u9fff]/.test(value)) return fromLatin1;

    return value;
  } catch {
    return value;
  }
}
