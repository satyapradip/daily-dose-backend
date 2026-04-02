import express from 'express';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middlewares/errorHandler';
import userRoutes from './routes/userRoutes';
import preferenceRoutes from './routes/preferenceRoutes';

const app = express();

// Required for accurate client IP detection behind reverse proxies (Railway/Render/etc.).
app.set('trust proxy', 1);

const appRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/',
  message: {
    success: false,
    error: 'Too many requests. Please try again in a few minutes.'
  }
});

app.use(express.json());
app.use(appRateLimiter);

// Mount feature routes.
app.use('/api/users', userRoutes);
app.use('/api/preferences', preferenceRoutes);

app.get('/', (_req, res) => {
  res.json({ status: 'Daily Dose API is running ✓' });
})

// Global error handler
app.use(errorHandler);

export default app;