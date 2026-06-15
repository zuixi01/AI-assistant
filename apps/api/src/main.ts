import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { AppModule } from './app.module';

// Prisma returns BigInt for @db fields; JSON.stringify cannot serialize BigInt natively
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

// #region debug-point A:process-runtime
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

function reportDebug(
  hypothesisId: string,
  msg: string,
  data: Record<string, unknown> = {},
) {
  fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId: 'pre-fix',
      hypothesisId,
      location: 'apps/api/src/main.ts',
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}

process.on('uncaughtExceptionMonitor', (error, origin) => {
  reportDebug('A', 'uncaught-exception-monitor', {
    origin,
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
});

process.on('unhandledRejection', (reason) => {
  const rejection =
    reason instanceof Error
      ? { name: reason.name, message: reason.message, stack: reason.stack }
      : { reason: String(reason) };
  reportDebug('A', 'unhandled-rejection', rejection);
});

process.on('warning', (warning) => {
  reportDebug('C', 'process-warning', {
    name: warning.name,
    message: warning.message,
    stack: warning.stack,
  });
});

process.on('beforeExit', (code) => {
  reportDebug('A', 'process-before-exit', { code, pid: process.pid });
});
// #endregion

async function bootstrap() {
  const port = Number(process.env.API_PORT || 4000);
  reportDebug('A', 'bootstrap-start', {
    pid: process.pid,
    port,
    nodeEnv: process.env.NODE_ENV || 'development',
  });

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.APP_URL || 'http://localhost:3100',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('AI 智能咨询助手 API')
    .setDescription('AI 智能咨询与抖音电商转化助手 API 文档')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // #region debug-point C:resource-heartbeat
  const heartbeat = setInterval(() => {
    const memory = process.memoryUsage();
    reportDebug('C', 'resource-heartbeat', {
      pid: process.pid,
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external,
      arrayBuffers: memory.arrayBuffers,
      uptimeSec: process.uptime(),
    });
  }, 60_000);
  heartbeat.unref();
  // #endregion

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    reportDebug('E', 'shutdown-start', { signal, pid: process.pid });
    clearInterval(heartbeat);
    const forceExitTimer = setTimeout(() => {
      reportDebug('E', 'shutdown-timeout', { signal, pid: process.pid });
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    try {
      await app.close();
      reportDebug('E', 'shutdown-success', { signal, pid: process.pid });
      process.exit(0);
    } catch (error) {
      reportDebug('E', 'shutdown-failed', {
        signal,
        pid: process.pid,
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  // #region debug-point A:listen
  const server = await app.listen(port);
  if ('keepAliveTimeout' in server) {
    (server as any).keepAliveTimeout = 65_000;
  }
  if ('headersTimeout' in server) {
    (server as any).headersTimeout = 66_000;
  }
  reportDebug('A', 'listen-success', {
    pid: process.pid,
    port,
    uptimeSec: process.uptime(),
  });
  // #endregion
  console.log(`API server running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  reportDebug('A', 'bootstrap-failed', {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  throw error;
});
