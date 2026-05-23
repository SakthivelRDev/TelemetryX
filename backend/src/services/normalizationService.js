const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Normalization Service
 * Maps raw external alarm formats → internal raw_alarms schema.
 * This is step 2 of the ingestion pipeline (after mock generation).
 */

// ── Severity Mapping ──────────────────────────────────────────────────────

// sourceA: level (string) → Severity enum
const SOURCE_A_SEVERITY_MAP = {
  high:   'CRITICAL',
  medium: 'MAJOR',
  low:    'MINOR',
  info:   'INFO',
};

// sourceB: priority (number) → Severity enum
const SOURCE_B_SEVERITY_MAP = {
  1: 'CRITICAL',
  2: 'MAJOR',
  3: 'MINOR',
  4: 'WARNING',
};

// ── Site ID Lookup Cache ──────────────────────────────────────────────────
let siteCache = null;

async function getSiteCache() {
  if (!siteCache) {
    const sites = await prisma.site.findMany();
    siteCache = {};
    sites.forEach((s) => {
      // Map siteId slug to DB UUID
      const slug = s.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      siteCache[slug] = s.id;
    });
  }
  return siteCache;
}

// ── Source A Normalization ─────────────────────────────────────────────────
/**
 * sourceA raw format: { alarmId, site, device, level, msg, time }
 * Maps to internal raw_alarms schema
 */
async function normalizeSourceA(rawAlarms) {
  const cache = await getSiteCache();
  const normalized = [];

  for (const alarm of rawAlarms) {
    const siteId = cache[alarm.site];
    if (!siteId) {
      console.warn(`[NORMALIZE] sourceA: Unknown site '${alarm.site}', skipping`);
      continue;
    }

    const severity = SOURCE_A_SEVERITY_MAP[alarm.level] || 'INFO';

    normalized.push({
      source: 'sourceA',
      siteId,
      deviceId: alarm.device,
      severity,
      message: alarm.msg,
      timestamp: new Date(alarm.time),
      normalized: true,
    });
  }

  return normalized;
}

// ── Source B Normalization ─────────────────────────────────────────────────
/**
 * sourceB raw format: { id, location, equipment, priority, description, timestamp }
 * Maps to internal raw_alarms schema
 */
async function normalizeSourceB(rawAlarms) {
  const cache = await getSiteCache();
  const normalized = [];

  for (const alarm of rawAlarms) {
    const siteId = cache[alarm.location];
    if (!siteId) {
      console.warn(`[NORMALIZE] sourceB: Unknown location '${alarm.location}', skipping`);
      continue;
    }

    const severity = SOURCE_B_SEVERITY_MAP[alarm.priority] || 'INFO';

    normalized.push({
      source: 'sourceB',
      siteId,
      deviceId: alarm.equipment,
      severity,
      message: alarm.description,
      timestamp: new Date(alarm.timestamp),
      normalized: true,
    });
  }

  return normalized;
}

// Invalidate cache (useful for tests / after new sites added)
function invalidateSiteCache() {
  siteCache = null;
}

module.exports = { normalizeSourceA, normalizeSourceB, invalidateSiteCache };
