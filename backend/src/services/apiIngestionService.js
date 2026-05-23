const { generateSourceA, generateSourceB } = require('../mock/mockAlarmGenerator');
const { normalizeSourceA, normalizeSourceB }           = require('./normalizationService');
const { correlateAlarms }                              = require('./correlationService');
const alarmRepository    = require('../repositories/alarmRepository');
const apiSourceRepository = require('../repositories/apiSourceRepository');
const { PrismaClient }   = require('@prisma/client');
const prisma             = new PrismaClient();

/**
 * API Ingestion Service – Pipeline Orchestrator
 *
 * Pipeline: Mock Generate → Normalize → Save → Correlate → Update Source Status
 * Runs every 10 seconds via setInterval in app.js
 */
async function runIngestion() {
  try {
    console.log('\n[INGEST] ─────────────── Starting ingestion run ───────────────');

    // ── Step 1: Generate raw alarms from mock sources ─────────────────────
    const rawA = generateSourceA(Math.floor(Math.random() * 4) + 2); // 2–5 alarms
    const rawB = generateSourceB(Math.floor(Math.random() * 4) + 2); // 2–5 alarms
    console.log(`[INGEST] Pulled ${rawA.length} alarms from sourceA, ${rawB.length} from sourceB`);

    // ── Step 2: Normalize into internal schema ─────────────────────────────
    const normalizedA = await normalizeSourceA(rawA);
    const normalizedB = await normalizeSourceB(rawB);
    const allNormalized = [...normalizedA, ...normalizedB];
    console.log(`[INGEST] Normalized: ${normalizedA.length} from sourceA, ${normalizedB.length} from sourceB`);

    if (allNormalized.length === 0) {
      console.log('[INGEST] No valid alarms after normalization, skipping correlation');
      return;
    }

    // ── Step 3: Persist to raw_alarms ─────────────────────────────────────
    // We need individual IDs for correlation, so create one by one
    const savedAlarms = [];
    for (const alarm of allNormalized) {
      const saved = await prisma.rawAlarm.create({ data: alarm });
      savedAlarms.push(saved);
    }
    console.log(`[INGEST] Saved ${savedAlarms.length} raw alarms to DB`);

    // ── Step 4: Run correlation engine ────────────────────────────────────
    await correlateAlarms(savedAlarms);
    console.log('[INGEST] Correlation complete');

    // ── Step 5: Update API source last polled timestamps ──────────────────
    const sources = await apiSourceRepository.findAll();
    for (const source of sources) {
      if (source.url.startsWith('mock://')) {
        await apiSourceRepository.updatePolled(source.id);
      }
    }

    // ── Step 6: Recalculate site statuses based on open alarms ────────────
    await recalculateSiteStatuses();

    console.log('[INGEST] ──────────────────────────────────────────────────────\n');
  } catch (err) {
    console.error('[INGEST] ❌ Ingestion error:', err.message);
  }
}

/**
 * Recalculate site status based on worst open correlated event severity
 */
async function recalculateSiteStatuses() {
  const sites = await prisma.site.findMany();

  for (const site of sites) {
    const openEvents = await prisma.correlatedEvent.findMany({
      where: { siteId: site.id, status: 'OPEN' },
    });

    let worstStatus = 'OK';
    for (const event of openEvents) {
      if (event.severity === 'CRITICAL') { worstStatus = 'CRITICAL'; break; }
      if (event.severity === 'MEDIUM' && worstStatus !== 'CRITICAL') {
        worstStatus = 'WARNING';
      }
    }

    if (site.status !== worstStatus) {
      await prisma.site.update({ where: { id: site.id }, data: { status: worstStatus } });
    }
  }
}

module.exports = { runIngestion };
