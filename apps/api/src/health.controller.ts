import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import * as net from 'node:net';
import { PrismaService } from './common/prisma/prisma.service';

// #region debug-point D:health-check
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

function reportDebug(data: Record<string, unknown>) {
  fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId: 'pre-fix',
      hypothesisId: 'D',
      location: 'apps/api/src/health.controller.ts',
      msg: '[DEBUG] health-check-hit',
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

function parseHostAndPort(urlString: string, defaultPort: number) {
  const parsed = new URL(urlString);
  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port ? Number(parsed.port) : defaultPort,
  };
}

function canConnect(host: string, port: number, timeoutMs: number) {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host, port });

    const onError = (error: Error) => {
      socket.destroy();
      rejectPromise(error);
    };

    socket.setTimeout(timeoutMs, () => {
      onError(new Error(`timeout after ${timeoutMs}ms`));
    });

    socket.once('connect', () => {
      socket.end();
      resolvePromise();
    });

    socket.once('error', onError);
  });
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    reportDebug({
      pid: process.pid,
      uptimeSec: process.uptime(),
      rss: process.memoryUsage().rss,
    });
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  }

  @Get('ready')
  async ready() {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      sidecar: await this.checkSidecar(),
    };

    const hasFailure = Object.values(checks).some(
      (check) =>
        (!('required' in check) || check.required !== false) &&
        check.status !== 'ok',
    );
    const payload = {
      status: hasFailure ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      checks,
    };

    reportDebug({
      pid: process.pid,
      readiness: payload.status,
      checks: payload.checks,
    });

    if (hasFailure) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return { status: 'ok' as const };
    } catch (error) {
      return {
        status: 'error' as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkRedis() {
    const redis = parseHostAndPort(
      process.env.REDIS_URL || 'redis://localhost:6380',
      6379,
    );

    try {
      await canConnect(redis.host, redis.port, 2_000);
      return { status: 'ok' as const, host: redis.host, port: redis.port };
    } catch (error) {
      return {
        status: 'error' as const,
        host: redis.host,
        port: redis.port,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkSidecar() {
    const enabled = process.env.RAG_SIDECAR_ENABLED === 'true';
    if (!enabled) {
      return { status: 'skipped' as const, required: false, enabled: false };
    }

    const baseUrl = process.env.RAG_SIDECAR_URL || 'http://localhost:8001';
    const token =
      process.env.RAG_SIDECAR_SHARED_TOKEN || process.env.SIDECAR_SHARED_TOKEN || '';
    const headers = token ? { 'X-Sidecar-Token': token } : undefined;

    try {
      const response = await fetch(`${baseUrl}/health`, {
        headers,
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) {
        return {
          status: 'error' as const,
          url: baseUrl,
          message: `HTTP ${response.status}`,
        };
      }

      const body = (await response.json()) as Record<string, unknown>;
      return {
        status: 'ok' as const,
        url: baseUrl,
        detail: body.status || 'ok',
      };
    } catch (error) {
      return {
        status: 'error' as const,
        url: baseUrl,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
