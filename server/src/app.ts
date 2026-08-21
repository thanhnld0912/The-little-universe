import express, { type Express } from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction, isTest } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/health.routes.js';
import { AppError } from './utils/errors.js';

function buildCorsOptions(): CorsOptions {
  const allowed = env.corsOrigins;
  const allowAny = allowed.includes('*');

  return {
    origin(origin, callback) {
      // Same-origin, curl and server-to-server requests send no Origin header.
      if (!origin) return callback(null, true);
      if (allowAny || allowed.includes(origin)) return callback(null, true);
      return callback(AppError.forbidden(`Origin ${origin} is not allowed.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400,
  };
}

export function createApp(): Express {
  const app = express();

  // Vercel terminates TLS and forwards the caller's address in X-Forwarded-For.
  // Needed for correct `req.ip`, which rate limiting will key on.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors(buildCorsOptions()));

  if (!isTest) {
    app.use(morgan(isProduction ? 'combined' : 'dev'));
  }

  // Readings and prompts are short; a small cap keeps oversized bodies from
  // ever reaching validation.
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/health', healthRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
