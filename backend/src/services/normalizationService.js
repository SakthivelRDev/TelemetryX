const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Normalization Service – Telecom AIOps
 *
 * Maps raw external alarm formats → internal raw_alarms schema (3-level severity).
 * Severity mapping:
 *   CRITICAL = service-affecting events (cell outage, session drops, link down)
 *   MEDIUM   = degraded performance (high loss, intermittent failure)
 *   LOW      = sub-optimal conditions, informational but actionable
 *
 * Source A: { alarmId, site, device, level, msg, time }
 *   level: high → CRITICAL, medium → MEDIUM, low → LOW
 *
 * Source B: { id, location, equipment, priority, description, timestamp }
 *   priority: 1 → CRITICAL, 2 → MEDIUM, 3 → LOW
 */

// ── Severity Maps ──────────────────────────────────────────────────────────
const SOURCE_A_SEVERITY_MAP = {
  high:   'CRITICAL',
  medium: 'MEDIUM',
  low:    'LOW',
};

const SOURCE_B_SEVERITY_MAP = {
  1: 'CRITICAL',
  2: 'MEDIUM',
  3: 'LOW',
};

// ── Site Cache (slug → { id, networkLayer }) ──────────────────────────────
let siteCache = null;

async function getSiteCache() {
  if (!siteCache) {
    const sites = await prisma.site.findMany();
    siteCache = {};
    sites.forEach((s) => {
      const slug = s.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      siteCache[slug] = { id: s.id, networkLayer: s.networkLayer };
    });
  }
  return siteCache;
}

// ── Source A Normalization ─────────────────────────────────────────────────
async function normalizeSourceA(rawAlarms) {
  const cache = await getSiteCache();
  const normalized = [];

  for (const alarm of rawAlarms) {
    const siteEntry = cache[alarm.site];
    if (!siteEntry) {
      console.warn(`[NORMALIZE] sourceA: Unknown site '${alarm.site}', skipping`);
      continue;
    }

    normalized.push({
      source:       'sourceA',
      siteId:       siteEntry.id,
      deviceId:     alarm.device,
      severity:     SOURCE_A_SEVERITY_MAP[alarm.level] || 'LOW',
      message:      alarm.msg,
      timestamp:    new Date(alarm.time),
      normalized:   true,
      networkLayer: siteEntry.networkLayer || 'TRANSPORT',
    });
  }

  return normalized;
}

// ── Source B Normalization ─────────────────────────────────────────────────
async function normalizeSourceB(rawAlarms) {
  const cache = await getSiteCache();
  const normalized = [];

  for (const alarm of rawAlarms) {
    const siteEntry = cache[alarm.location];
    if (!siteEntry) {
      console.warn(`[NORMALIZE] sourceB: Unknown location '${alarm.location}', skipping`);
      continue;
    }

    normalized.push({
      source:       'sourceB',
      siteId:       siteEntry.id,
      deviceId:     alarm.equipment,
      severity:     SOURCE_B_SEVERITY_MAP[alarm.priority] || 'LOW',
      message:      alarm.description,
      timestamp:    new Date(alarm.timestamp),
      normalized:   true,
      networkLayer: siteEntry.networkLayer || 'TRANSPORT',
    });
  }

  return normalized;
}

function invalidateSiteCache() {
  siteCache = null;
}

module.exports = { normalizeSourceA, normalizeSourceB, invalidateSiteCache };
