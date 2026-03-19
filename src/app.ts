import express from 'express';
import { errorHandler } from './middlewares/errorHandler';
import logger from './utils/logger';

const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'Daily Dose API is running ✓' });
})

// Global error handler
app.use(errorHandler);

export default app;