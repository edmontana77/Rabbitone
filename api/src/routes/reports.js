import { Router } from 'express';
import {
  listComputers,
  countComputers,
  listSoftwareInstances,
  getOsVersionSummary,
  getSoftwarePresenceSummary,
} from '../db.js';

export const reportsRouter = Router();

reportsRouter.get('/computers', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const offset = Number(req.query.offset) || 0;
  res.json({
    total: countComputers(),
    limit,
    offset,
    computers: listComputers({ limit, offset }),
  });
});

reportsRouter.get('/software', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const offset = Number(req.query.offset) || 0;
  res.json({
    limit,
    offset,
    softwareInstances: listSoftwareInstances({
      computerId: req.query.computerId,
      name: req.query.name,
      limit,
      offset,
    }),
  });
});

// Feeds OS-version-style dashboards (e.g. the Windows 11 / Unix EOS
// dashboards in this repo): counts of synced computers per OS + version.
reportsRouter.get('/os-summary', (req, res) => {
  res.json({ summary: getOsVersionSummary() });
});

// Feeds security-agent-compliance style reports (mirrors
// bf-cs-trellix-report.bes): which of the requested agents/software
// products are installed on each computer, based on synced software
// inventory names. Defaults to the four agents that script checks for.
const DEFAULT_AGENTS = ['CrowdStrike', 'Trellix', 'Rapid7 Insight Agent', 'BES Client'];

reportsRouter.get('/security-agents', (req, res) => {
  const names = req.query.names
    ? String(req.query.names).split(',').map((n) => n.trim()).filter(Boolean)
    : DEFAULT_AGENTS;

  const rows = getSoftwarePresenceSummary(names);
  const byComputer = new Map();
  for (const row of rows) {
    if (!byComputer.has(row.computer_id)) {
      byComputer.set(row.computer_id, {
        computerId: row.computer_id,
        computerName: row.computer_name,
        installed: new Set(),
      });
    }
    byComputer.get(row.computer_id).installed.add(row.software_name);
  }

  const computers = [...byComputer.values()].map((c) => ({
    computerId: c.computerId,
    computerName: c.computerName,
    agents: Object.fromEntries(names.map((n) => [n, c.installed.has(n)])),
  }));

  res.json({ requestedAgents: names, computers });
});
