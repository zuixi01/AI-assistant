import { DocumentParser, ParsedDocument, ContentSection } from './parser.interface';

/** Supported image MIME types */
const IMAGE_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
};

export class ImageParser implements DocumentParser {
  readonly supportedTypes = Object.keys(IMAGE_MIME_MAP);

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mime = IMAGE_MIME_MAP[ext] || 'application/octet-stream';

    // Generate a text description from the image metadata
    const sizeKB = (buffer.length / 1024).toFixed(1);
    const imageBase64 = buffer.toString('base64');
    const description = `[Image: ${filename}] (${sizeKB}KB, ${mime})`;

    const sections: ContentSection[] = [
      {
        type: 'image',
        content: description,
        sectionIndex: 0,
        metadata: {
          imageBase64: imageBase64.substring(0, 100), // Truncated preview
          imageDescription: description,
          imageMime: mime,
          caption: filename,
        },
      },
    ];

    return {
      content: description,
      metadata: {
        fileName: filename,
        mimeType: mime,
        sizeBytes: buffer.length,
        sizeKB,
      },
      sections,
    };
  }

  /**
   * Generate an AI-powered image description using a vision model.
   * This is called separately by the pipeline when a vision provider is configured.
   */
  async generateVisionDescription(buffer: Buffer, filename: string): Promise<string> {
    const sizeKB = (buffer.length / 1024).toFixed(1);
    return `[Image: ${filename}] Size: ${sizeKB}KB. Use vision model for detailed description.`;
  }
}
