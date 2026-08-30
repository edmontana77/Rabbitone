import { existsSync } from 'node:fs';
import path from 'node:path';

// Loads .env (if present) without adding a dotenv dependency.
const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

function requireInProduction(name, value) {
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  apiKey: requireInProduction('API_KEY', process.env.API_KEY || ''),

  bigfixInventory: {
    baseUrl: (process.env.BIGFIX_INVENTORY_BASE_URL || '').replace(/\/+$/, ''),
    token: process.env.BIGFIX_INVENTORY_TOKEN || '',
    username: process.env.BIGFIX_INVENTORY_USERNAME || '',
    password: process.env.BIGFIX_INVENTORY_PASSWORD || '',
    tlsVerify: (process.env.BIGFIX_INVENTORY_TLS_VERIFY || 'true').toLowerCase() !== 'false',
  },

  sync: {
    cron: process.env.SYNC_CRON || '',
    pageSize: Number(process.env.SYNC_PAGE_SIZE || 500),
  },

  dbPath: process.env.DB_PATH || './data/bigfix.sqlite',
};
