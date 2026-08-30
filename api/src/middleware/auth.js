import { config } from '../config.js';

// Simple bearer-token auth for this API's own clients (dashboards, scripts).
// Unrelated to the credentials used to talk to BigFix Inventory itself.
export function requireApiKey(req, res, next) {
  if (!config.apiKey) {
    // No API_KEY configured (e.g. local dev) — leave the API open.
    return next();
  }
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token === config.apiKey) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized: missing or invalid API key' });
}
