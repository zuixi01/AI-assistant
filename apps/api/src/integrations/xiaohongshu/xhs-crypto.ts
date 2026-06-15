import { createCipheriv, createDecipheriv } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-128-cbc';
const DELIMITER = '~split~';

@Injectable()
export class XhsCrypto {
  private readonly logger = new Logger(XhsCrypto.name);
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const keyHex = this.configService.get<string>('XHS_CRYPTO_KEY', '');
    if (!keyHex || keyHex.length !== 32) {
      this.logger.warn('XHS_CRYPTO_KEY not set or invalid (need 32 hex chars = 16 bytes). XHS encryption/decryption will fail.');
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  decrypt(encrypted: string): string {
    const [ivB64, dataB64] = encrypted.split(DELIMITER);
    if (!ivB64 || !dataB64) {
      throw new Error(`Invalid XHS encrypted format, expected "iv${DELIMITER}data"`);
    }

    const iv = Buffer.from(ivB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }

  encrypt(plain: string): string {
    const iv = Buffer.alloc(16, 0);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `${iv.toString('base64')}${DELIMITER}${encrypted.toString('base64')}`;
  }
}
