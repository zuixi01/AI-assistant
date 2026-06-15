import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('admin web auth contract', () => {
  it('does not store or send bearer tokens from admin pages', () => {
    const files = walk(join(process.cwd(), 'apps/web/src/app/admin')).filter((file) =>
      file.endsWith('.tsx'),
    );

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/localStorage/);
      expect(source, file).not.toMatch(/headers\s*:\s*\{[\s\S]{0,200}['"`]Authorization['"`]/);
      expect(source, file).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/);
    }
  });
});
