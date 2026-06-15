import { DocumentParser, ParsedDocument, ContentSection } from './parser.interface';

export class PptxParser implements DocumentParser {
  readonly supportedTypes = ['pptx', 'ppt'];

  async parse(buffer: Buffer, _filename: string): Promise<ParsedDocument> {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);

      // PPTX slides are in ppt/slides/slide*.xml
      const slideFiles = Object.keys(zip.files)
        .filter((name) => /ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => {
          const na = parseInt(a.match(/slide(\d+)/i)?.[1] || '0');
          const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || '0');
          return na - nb;
        });

      const sections: ContentSection[] = [];
      const slideTexts: string[] = [];

      for (let i = 0; i < slideFiles.length; i++) {
        const xmlContent = await zip.files[slideFiles[i]].async('text');
        const text = this.extractTextFromSlideXml(xmlContent);
        if (text.trim()) {
          slideTexts.push(`## Slide ${i + 1}\n\n${text.trim()}`);
          sections.push({
            type: 'text',
            content: text.trim(),
            sectionIndex: i,
            metadata: { pageNumber: i + 1 },
          });
        }
      }

      // Extract tables from slides
      for (let i = 0; i < slideFiles.length; i++) {
        const xmlContent = await zip.files[slideFiles[i]].async('text');
        const tables = this.extractTablesFromXml(xmlContent, sections.length);
        sections.push(...tables);
      }

      return {
        content: slideTexts.join('\n\n'),
        metadata: { slideCount: slideFiles.length },
        sections,
      };
    } catch (error: any) {
      throw new Error(`PPTX parsing failed: ${error.message}`);
    }
  }

  private extractTextFromSlideXml(xml: string): string {
    // Extract text from <a:t> tags (PowerPoint text elements)
    const textRegex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    const texts: string[] = [];
    let match;
    while ((match = textRegex.exec(xml)) !== null) {
      if (match[1]) texts.push(match[1]);
    }
    return texts.join(' ');
  }

  private extractTablesFromXml(xml: string, startIndex: number): ContentSection[] {
    const sections: ContentSection[] = [];
    // Tables in PPTX are embedded via <a:graphicData> with table references
    // For now, detect table-like structures in the XML
    const tableRegex = /<a:tbl>([\s\S]*?)<\/a:tbl>/g;
    let match;
    let idx = 0;
    while ((match = tableRegex.exec(xml)) !== null) {
      const rows = match[1].match(/<a:tr[\s\S]*?<\/a:tr>/g) || [];
      const tableRows: string[][] = rows.map((row) => {
        const cells = row.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
        return cells.map((cell) => {
          const m = cell.match(/<a:t[^>]*>([^<]*)<\/a:t>/);
          return m?.[1] || '';
        });
      });
      if (tableRows.length > 0) {
        sections.push({
          type: 'table',
          content: tableRows.map((r) => r.join('\t')).join('\n'),
          sectionIndex: startIndex + idx,
          metadata: { tableHeaders: tableRows[0], tableRows },
        });
        idx++;
      }
    }
    return sections;
  }
}
