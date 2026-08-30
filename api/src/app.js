import express from 'express';
import { requireApiKey } from './middleware/auth.js';
import { syncRouter } from './routes/sync.js';
import { reportsRouter } from './routes/reports.js';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/sync', requireApiKey, syncRouter);
  app.use('/api/reports', requireApiKey, reportsRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
