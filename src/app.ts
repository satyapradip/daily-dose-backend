import express from 'express';
import { errorHandler } from './middlewares/errorHandler';
import userRoutes from './routes/userRoutes';
import preferenceRoutes from './routes/preferenceRoutes';

const app = express();

app.use(express.json());

// Mount feature routes.
app.use('/api/users', userRoutes);
app.use('/api/preferences', preferenceRoutes);

app.get('/', (_req, res) => {
  res.json({ status: 'Daily Dose API is running ✓' });
})

// Global error handler
app.use(errorHandler);

export default app;