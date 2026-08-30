import { config } from './config.js';
import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`BigFix Inventory sync API listening on port ${config.port}`);
  if (!config.apiKey) {
    console.warn('[server] API_KEY is not set — /api routes are unauthenticated. Set API_KEY in .env for real deployments.');
  }
  startScheduler();
});
