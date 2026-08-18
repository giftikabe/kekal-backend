import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorHandler } from './middleware/errorHandler';
import type { AppEnv } from './types/env';

import { authRouter } from './modules/auth/router';
import { tablesRouter } from './modules/tables/router';
import { pagesRouter, navRouter } from './modules/pages/router';
import { brandRouter } from './modules/brand/router';
import mediaRouter from './modules/media/media.router';
import { seoRouter } from './modules/seo/router';
import commerceRouter from './modules/commerce/router';
import { publishRouter } from './modules/publish/router';

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  const allowedOrigins = (c.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return cors({
    origin: (origin) => (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })(c, next);
});

app.onError(errorHandler);

app.get('/health', (c) => c.json({ data: { status: 'ok', service: 'kekal-backend' } }));

app.route('/api/auth',     authRouter);
app.route('/api/tables',   tablesRouter);
app.route('/api/pages',    pagesRouter);
app.route('/api/nav',      navRouter);
app.route('/api/brand',    brandRouter);
app.route('/api/media',    mediaRouter);
app.route('/api/seo',      seoRouter);
app.route('/api/commerce', commerceRouter);
app.route('/api/publish',  publishRouter);

app.notFound((c) =>
  c.json({ error: { message: 'Not found', code: 'NOT_FOUND' } }, 404),
);

export default app;