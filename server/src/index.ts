process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log(`[Lost Paint Studios] Booting server process (Node ${process.version}, ${process.platform} ${process.arch})...`);
console.log(`[Lost Paint Studios] Environment: NODE_ENV=${process.env.NODE_ENV || 'production'}, PORT=${process.env.PORT || 5000}`);

async function bootstrap() {
  try {
    // Check and restore remote cloud database snapshot if cloud storage is configured
    const { cloudSync } = await import('./services/cloudSync');
    await cloudSync.restoreIfAvailable();

    const { app } = await import('./app');
    const PORT = Number(process.env.PORT) || 5000;

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Lost Paint Studios] Server successfully running on port ${PORT}`);
      console.log(`[Lost Paint Studios] Health check available at /api/health and /health`);
    });

    server.on('error', (err: any) => {
      console.error('[FATAL] Server listen error:', err);
      process.exit(1);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`[Lost Paint Studios] Received ${signal}. Backing up and shutting down gracefully...`);
      try {
        await cloudSync.backupNow();
      } catch (e) {
        console.warn('[Lost Paint Studios] Cloud sync during shutdown failed:', e);
      }
      server.close(() => {
        console.log('[Lost Paint Studios] Server closed successfully.');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('[Lost Paint Studios] Shutdown timed out, forcing exit.');
        process.exit(1);
      }, 5000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err: any) {
    console.error('[FATAL] Failed to initialize application:', err);
    process.exit(1);
  }
}

bootstrap();
