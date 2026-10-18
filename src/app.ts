import express, { type Express } from 'express';
import { createHandler } from 'graphql-http/lib/use/express';
import { createLoaders } from './loaders';
import { rootValue, type Context } from './resolvers';
import { schema } from './schema';
import type { Store } from './store';

export interface AppOptions {
  store: Store;
}

export function createApp({ store }: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  // Liveness: the process is up. Readiness: it can serve requests (no external dependencies yet).
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/readyz', (_req, res) => {
    res.json({ status: 'ready' });
  });

  app.all(
    '/graphql',
    createHandler({
      schema,
      rootValue,
      context: (): Context => ({ store, loaders: createLoaders(store) }),
    }),
  );

  return app;
}
