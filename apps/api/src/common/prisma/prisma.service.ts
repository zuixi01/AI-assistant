import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

// #region debug-point B:prisma-lifecycle
const debugEnvPath = '.dbg/server-connection-refused.env';
let debugServerUrl = 'http://127.0.0.1:7777/event';
let debugSessionId = 'server-connection-refused';
try {
  const debugEnv = readFileSync(debugEnvPath, 'utf8');
  debugServerUrl =
    debugEnv.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
  debugSessionId =
    debugEnv.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId;
} catch {}

function reportDebug(msg: string, data: Record<string, unknown> = {}) {
  fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId: 'pre-fix',
      hypothesisId: 'B',
      location: 'apps/api/src/common/prisma/prisma.service.ts',
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    reportDebug('prisma-connect-start', {
      pid: process.pid,
      databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ':***@'),
    });
    try {
      await this.$connect();
      reportDebug('prisma-connect-success', { pid: process.pid });
    } catch (error) {
      reportDebug('prisma-connect-failed', {
        pid: process.pid,
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async onModuleDestroy() {
    reportDebug('prisma-disconnect-start', { pid: process.pid });
    try {
      await this.$disconnect();
      reportDebug('prisma-disconnect-success', { pid: process.pid });
    } catch (error) {
      reportDebug('prisma-disconnect-failed', {
        pid: process.pid,
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
