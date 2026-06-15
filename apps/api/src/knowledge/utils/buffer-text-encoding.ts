import iconv from 'iconv-lite';

/** 优先 UTF-8；若出现大量替换符则尝试 GB18030（常见于中文 Windows 导出的 TXT/CSV） */
export function decodeTextBufferUtf8OrGb18030(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');
  const badUtf = (utf8.match(/\uFFFD/g) || []).length;
  if (badUtf === 0) return utf8;

  try {
    const gb = iconv.decode(buffer, 'gb18030');
    const badGb = (gb.match(/\uFFFD/g) || []).length;
    if (badGb < badUtf) return gb;
  } catch {
    /* ignore */
  }

  return utf8;
}
