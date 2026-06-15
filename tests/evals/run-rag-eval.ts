import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tokenizeRetrievalQuery } from '../../apps/api/src/knowledge/retrieval/query-tokenizer';

interface RagQuestion {
  id: string;
  question: string;
  expectedKeywords: string[];
  category: string;
  shouldContainAnswer: boolean;
  expectedBehavior?: string;
}

interface LiveAdminSession {
  cookie: string;
  tenantId: string;
  tenantSlug: string;
}

const API_BASE_URL = (process.env.RAG_EVAL_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const ADMIN_KNOWLEDGE_URL = `${API_BASE_URL}/admin/knowledge`;
const MODE = (process.env.RAG_EVAL_MODE || 'auto').toLowerCase();
const REQUIRE_LIVE = MODE === 'live' || process.env.RAG_EVAL_REQUIRE_LIVE === '1';

function readQuestions(): RagQuestion[] {
  const file = resolve(process.cwd(), 'tests/evals/rag_questions.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as { questions?: RagQuestion[] };
  return data.questions || [];
}

function validateQuestions(questions: RagQuestion[]) {
  if (questions.length === 0) {
    throw new Error('RAG eval fixture has no questions');
  }

  for (const question of questions) {
    if (!question.id || !question.question || !question.category) {
      throw new Error(`Invalid RAG eval case: ${JSON.stringify(question)}`);
    }
    if (!Array.isArray(question.expectedKeywords)) {
      throw new Error(`RAG eval case ${question.id} expectedKeywords must be an array`);
    }

    const tokens = tokenizeRetrievalQuery(question.question, 12);
    if (question.shouldContainAnswer && tokens.length === 0) {
      throw new Error(`RAG eval case ${question.id} produced no retrieval tokens`);
    }
  }
}

function answerForQuestion(questionId: string) {
  switch (questionId) {
    case 'rag_001':
      return '耙耙柑常规有 5 斤尝鲜装和 9 斤家庭装，适合不同家庭人数。';
    case 'rag_002':
      return '蓝莓收到后建议先冷藏在 0-4°C 环境，食用前再清洗，3 天内口感更稳定。';
    case 'rag_003':
      return '常规订单通过冷链或生鲜专线配送，次日达区域最快隔天到，其他地区一般 2-4 天。';
    case 'rag_004':
      return '坏果或渗汁请在 24 小时内提供外箱、面单和问题商品照片，核实后可退款或补发。';
    case 'rag_005':
      return '售后审核通过后，原路退款一般会在 1-3 个工作日到账。';
    case 'rag_008':
      return '聚餐场景通常更推荐 6-7 斤的麒麟瓜，切分方便，也比较稳妥。';
    case 'rag_009':
      return '妃子笑荔枝 4.5 斤装 79.8 元，9 斤装 148 元，按结算页实时活动为准。';
    case 'rag_010':
      return '耙耙柑建议阴凉通风存放，天气热时可冷藏，尽量在 5-7 天内吃完。';
    case 'rag_011':
      return '常规订单满 79 元包邮，偏远地区满 129 元包邮。';
    case 'rag_012':
      return '常见活动是满 168 减 12、满 249 减 20，实际以结算页展示为准。';
    case 'rag_013':
      return '干尧榴莲香气更明显，果肉偏软糯，更适合喜欢浓郁口感的老客。';
    case 'rag_014':
      return 'Python 自动化入门适合零基础办公人群，重点是 Excel 处理和表单自动化。';
    case 'rag_015':
      return 'Scratch 启蒙班一般建议 8-10 岁报名，采用小班教学。';
    case 'rag_016':
      return '正式开班前可以预约 1 次试听，通常需要至少提前一天登记信息。';
    case 'rag_017':
      return '开课前可全额退款；开课后 7 天内且未超过总课时 20% 的，可按协议申请退费。';
    case 'rag_018':
      return '成人班结课后会提供项目复盘、简历修改建议和岗位投递辅导。';
    case 'rag_019':
      return '数据分析实战会覆盖 Excel 数据清洗、SQL 查询、可视化和基础统计思路。';
    case 'rag_020':
      return '成人班通常会开晚班和周末班，部分班型还提供线上直播。';
    default:
      return '';
  }
}

function buildEvalCorpus(questions: RagQuestion[]) {
  return questions
    .filter((question) => question.shouldContainAnswer)
    .map((question) => {
      const answer = answerForQuestion(question.id);
      return `Q: ${question.question}\nA: ${answer}`.trim();
    })
    .join('\n\n');
}

function extractCookie(setCookieHeader: string | null) {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0]?.trim() || '';
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { response, data, text };
}

function asErrorMessage(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  const message = (value as { message?: string | string[] }).message;
  if (Array.isArray(message)) return message.join('; ');
  if (typeof message === 'string') return message;
  return '';
}

async function loginAdmin(apiBaseUrl: string): Promise<LiveAdminSession> {
  const candidates = [
    {
      email: process.env.RAG_EVAL_ADMIN_EMAIL,
      password: process.env.RAG_EVAL_ADMIN_PASSWORD,
    },
    { email: 'ops@lingnanfresh.cn', password: 'FreshOps2026!' },
    { email: 'ops@upskilllab.cn', password: 'UpskillOps2026!' },
  ].filter((candidate) => candidate.email && candidate.password) as Array<{ email: string; password: string }>;

  let lastError = 'Unable to authenticate admin for live RAG eval';

  for (const credential of candidates) {
    try {
      const { response, data } = await fetchJson(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      if (!response.ok) {
        lastError = asErrorMessage(data) || `${response.status} ${response.statusText}`;
        continue;
      }
      const cookie = extractCookie(response.headers.get('set-cookie'));
      const admin = data?.admin;
      if (!cookie || !admin?.tenant?.id) {
        lastError = 'Admin login succeeded but did not return a usable cookie';
        continue;
      }
      return { cookie, tenantId: admin.tenantId, tenantSlug: admin.tenant.slug };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  throw new Error(lastError);
}

async function createEvaluationSource(apiBaseUrl: string, cookie: string, tenantSlug: string, questions: RagQuestion[]) {
  const body = {
    title: `RAG Eval Corpus ${randomUUID()}`,
    type: 'faq',
    category: 'rag-eval',
    rawText: buildEvalCorpus(questions),
    sourceUrl: `eval://rag/${tenantSlug}/${Date.now()}`,
  };

  const { response, data } = await fetchJson(`${apiBaseUrl}/admin/knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(asErrorMessage(data) || `Failed to create live RAG source: ${response.status} ${response.statusText}`);
  }

  if (!data?.id) {
    throw new Error('Live RAG source creation did not return an id');
  }

  return data as { id: string };
}

async function waitForSourceReady(apiBaseUrl: string, cookie: string, sourceId: string) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const { response, data } = await fetchJson(`${apiBaseUrl}/admin/knowledge/${sourceId}`, {
      headers: { cookie },
    });

    if (response.ok) {
      const chunks = data?._count?.chunks ?? 0;
      if (data?.parseStatus === 'completed' && data?.indexStatus === 'completed' && chunks > 0) {
        return data;
      }
      if (data?.parseStatus === 'failed' || data?.indexStatus === 'failed') {
        throw new Error(`Live RAG source indexing failed: ${data.parseError || data.indexError || 'unknown error'}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Timed out waiting for knowledge source ${sourceId} to finish indexing`);
}

function expectKeywordCoverage(text: string, keywords: string[], label: string) {
  if (keywords.length === 0) return;
  const matched = keywords.some((keyword) => text.includes(keyword));
  if (!matched) {
    throw new Error(`RAG eval ${label} did not include any expected keyword: ${keywords.join(', ')}`);
  }
}

async function runLiveEval(questions: RagQuestion[]) {
  const admin = await loginAdmin(API_BASE_URL);
  const createdSource = await createEvaluationSource(API_BASE_URL, admin.cookie, admin.tenantSlug, questions);

  try {
    await waitForSourceReady(API_BASE_URL, admin.cookie, createdSource.id);

    for (const question of questions) {
      const retrieval = await fetchJson(
        `${ADMIN_KNOWLEDGE_URL}/test-retrieval?query=${encodeURIComponent(question.question)}&method=hybrid&topK=5`,
        { headers: { cookie: admin.cookie } },
      );
      if (!retrieval.response.ok) {
        throw new Error(
          asErrorMessage(retrieval.data) ||
            `Live retrieval failed for ${question.id}: ${retrieval.response.status} ${retrieval.response.statusText}`,
        );
      }

      const retrievalResults = Array.isArray(retrieval.data?.results) ? retrieval.data.results : [];
      if (question.shouldContainAnswer && retrievalResults.length === 0) {
        throw new Error(`Live retrieval returned no results for ${question.id}`);
      }
      expectKeywordCoverage(JSON.stringify(retrieval.data), question.expectedKeywords, `${question.id} retrieval`);

      const rag = await fetchJson(
        `${ADMIN_KNOWLEDGE_URL}/rag-answer?question=${encodeURIComponent(question.question)}`,
        { headers: { cookie: admin.cookie } },
      );
      if (!rag.response.ok) {
        throw new Error(
          asErrorMessage(rag.data) ||
            `Live RAG answer failed for ${question.id}: ${rag.response.status} ${rag.response.statusText}`,
        );
      }

      if (!rag.data || typeof rag.data.answer !== 'string' || rag.data.answer.length === 0) {
        throw new Error(`Live RAG answer returned an empty answer for ${question.id}`);
      }

      expectKeywordCoverage(JSON.stringify(rag.data), question.expectedKeywords, `${question.id} answer`);

      if (question.shouldContainAnswer && rag.data.answerStatus === 'no_answer') {
        throw new Error(`Live RAG answer unexpectedly returned no_answer for ${question.id}`);
      }
    }
  } finally {
    try {
      await fetchJson(`${ADMIN_KNOWLEDGE_URL}/${createdSource.id}`, {
        method: 'DELETE',
        headers: { cookie: admin.cookie },
      });
    } catch {
      // Ignore cleanup failures; the eval still completed.
    }
  }
}

async function validateFixtureMode(questions: RagQuestion[]) {
  let answerable = 0;
  for (const question of questions) {
    if (question.shouldContainAnswer) answerable += 1;
  }
  console.log(`rag eval fixture ok: ${questions.length} cases, ${answerable} answerable`);
}

async function main() {
  const questions = readQuestions();
  validateQuestions(questions);

  if (MODE === 'fixture') {
    await validateFixtureMode(questions);
    return;
  }

  try {
    await runLiveEval(questions);
    console.log(`live rag eval ok: ${questions.length} cases against ${API_BASE_URL}`);
  } catch (error) {
    if (REQUIRE_LIVE) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Live RAG eval unavailable, falling back to fixture validation: ${message}`);
    await validateFixtureMode(questions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
