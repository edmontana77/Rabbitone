import {
  mapComputer,
  mapSoftwareInstance,
  extractList,
  extractTotal,
} from './fieldMapping.js';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

export class BigFixInventoryError extends Error {
  constructor(message, { status, url } = {}) {
    super(message);
    this.name = 'BigFixInventoryError';
    this.status = status;
    this.url = url;
  }
}

export class BigFixInventoryClient {
  /**
   * @param {object} options
   * @param {string} options.baseUrl e.g. https://host:9081/api/v1
   * @param {string} [options.token] preferred: personal API token
   * @param {string} [options.username]
   * @param {string} [options.password]
   * @param {boolean} [options.tlsVerify]
   * @param {number} [options.pageSize]
   * @param {typeof fetch} [options.fetchImpl] injectable for tests
   */
  constructor({ baseUrl, token, username, password, tlsVerify = true, pageSize = 500, fetchImpl }) {
    if (!baseUrl) {
      throw new Error('BigFixInventoryClient requires a baseUrl');
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
    this.username = username;
    this.password = password;
    this.pageSize = pageSize;
    this.fetchImpl = fetchImpl || globalThis.fetch;

    if (!tlsVerify) {
      // Only intended for lab/self-signed BigFix Inventory servers.
      console.warn(
        '[bigfix-inventory] TLS certificate verification is DISABLED (BIGFIX_INVENTORY_TLS_VERIFY=false). Do not use in production.',
      );
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
  }

  _buildUrl(pathname, query = {}) {
    const url = new URL(`${this.baseUrl}${pathname}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    if (this.token) {
      url.searchParams.set('token', this.token);
    }
    return url;
  }

  _authHeaders() {
    if (!this.token && this.username) {
      const basic = Buffer.from(`${this.username}:${this.password || ''}`).toString('base64');
      return { Authorization: `Basic ${basic}` };
    }
    return {};
  }

  async _request(pathname, query = {}) {
    const url = this._buildUrl(pathname, query);
    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await this.fetchImpl(url, {
          headers: { Accept: 'application/json', ...this._authHeaders() },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          const error = new BigFixInventoryError(
            `BigFix Inventory request failed: ${response.status} ${response.statusText} for ${url.pathname}`,
            { status: response.status, url: url.toString() },
          );
          // Retry on server-side errors, not on 4xx client errors (bad auth/path).
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            lastError = error;
            await backoff(attempt);
            continue;
          }
          error.message += body ? ` - ${body.slice(0, 300)}` : '';
          throw error;
        }
        return response.json();
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof BigFixInventoryError) throw err;
        lastError = err;
        if (attempt < MAX_RETRIES) {
          await backoff(attempt);
          continue;
        }
      }
    }
    throw new BigFixInventoryError(
      `BigFix Inventory request failed after retries: ${lastError?.message || 'unknown error'}`,
      { url: url.toString() },
    );
  }

  async _fetchAllPages(pathname, mapFn) {
    const results = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const json = await this._request(pathname, { limit: this.pageSize, offset });
      const list = extractList(json);
      const total = extractTotal(json, list);
      for (const raw of list) {
        const mapped = mapFn(raw);
        if (mapped.id) results.push(mapped);
      }
      offset += list.length;
      if (list.length === 0 || offset >= total) break;
    }
    return results;
  }

  async fetchAllComputers() {
    return this._fetchAllPages('/computers', mapComputer);
  }

  async fetchAllSoftwareInstances() {
    return this._fetchAllPages('/swInstances', mapSoftwareInstance);
  }
}

function backoff(attempt) {
  const delayMs = 500 * 2 ** attempt;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
