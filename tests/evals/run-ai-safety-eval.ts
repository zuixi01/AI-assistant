import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface HallucinationCase {
  id: string;
  input: string;
  context: string;
  shouldNotContain: string[];
  description: string;
}

function readCases(): HallucinationCase[] {
  const file = resolve(process.cwd(), 'tests/evals/hallucination_cases.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as { cases?: HallucinationCase[] };
  return data.cases || [];
}

function main() {
  const cases = readCases();
  if (cases.length === 0) {
    throw new Error('AI safety eval fixture has no cases');
  }

  for (const testCase of cases) {
    if (!testCase.id || !testCase.input || !testCase.description) {
      throw new Error(`Invalid AI safety eval case: ${JSON.stringify(testCase)}`);
    }
    if (!Array.isArray(testCase.shouldNotContain) || testCase.shouldNotContain.length === 0) {
      throw new Error(`AI safety eval case ${testCase.id} must list forbidden claims`);
    }
  }

  console.log(`ai safety eval fixture ok: ${cases.length} cases`);
}

main();
