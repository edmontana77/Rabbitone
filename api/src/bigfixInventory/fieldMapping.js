// Central place to adjust how raw BigFix Inventory JSON fields map onto our
// local schema. BigFix Inventory deployments can differ slightly in field
// naming between versions/configurations, so each mapper tries a short list
// of common candidate keys instead of assuming one exact name. If your
// server uses different field names, add them to the candidate lists below
// rather than touching the sync logic.

function firstDefined(obj, keys) {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

export function mapComputer(raw) {
  const id = firstDefined(raw, ['id', 'computerId', 'computer_id']);
  return {
    id: id !== undefined ? String(id) : undefined,
    name: firstDefined(raw, ['name', 'computerName', 'displayName']),
    osName: firstDefined(raw, ['osName', 'os', 'operatingSystem']),
    osVersion: firstDefined(raw, ['osVersion', 'os_version']),
    ipAddress: firstDefined(raw, ['ipAddress', 'ip', 'ipAddr']),
    domain: firstDefined(raw, ['domain', 'domainName']),
    lastScanDate: firstDefined(raw, ['lastScanDate', 'lastScan', 'scanDate']),
    raw,
  };
}

export function mapSoftwareInstance(raw) {
  const id = firstDefined(raw, ['id', 'instanceId', 'swInstanceId']);
  const computerId = firstDefined(raw, ['computerId', 'computer_id', 'hostId']);
  return {
    id: id !== undefined ? String(id) : undefined,
    computerId: computerId !== undefined ? String(computerId) : undefined,
    softwareId: firstDefined(raw, ['softwareId', 'swId', 'catalogId']),
    name: firstDefined(raw, ['name', 'softwareName', 'title']),
    version: firstDefined(raw, ['version', 'softwareVersion']),
    publisher: firstDefined(raw, ['publisher', 'vendor', 'manufacturer']),
    category: firstDefined(raw, ['category', 'swType']),
    raw,
  };
}

// Tries each key in order and returns the first array-like value found,
// so we cope with the various list envelopes BigFix Inventory endpoints
// may return ([...], {data:[...]}, {items:[...]}, {computers:[...]}, etc.).
export function extractList(json, candidateKeys = ['data', 'items', 'resources']) {
  if (Array.isArray(json)) return json;
  for (const key of candidateKeys) {
    if (Array.isArray(json?.[key])) return json[key];
  }
  return [];
}

export function extractTotal(json, list) {
  const total = firstDefined(json, ['total', 'totalCount', 'count']);
  return typeof total === 'number' ? total : list.length;
}
