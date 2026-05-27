const alarmRepository    = require('../repositories/alarmRepository');
const correlationRepository = require('../repositories/correlationRepository');
const { PrismaClient }   = require('@prisma/client');
const prisma             = new PrismaClient();

/**
 * Correlation Service – AIOps Engine
 *
 * Applies 3 rule-based correlation rules to group raw alarms into
 * correlated events. This is step 3 of the ingestion pipeline.
 *
 * Rule 1 – Same Site + Same Device within 5 minutes
 *          groupKey = siteId:deviceId
 *
 * Rule 2 – Same Site, multiple CRITICAL/MAJOR devices within 10 minutes
 *          groupKey = siteId:MULTI
 *
 * Rule 3 – Standalone alarm (no match with other alarms)
 *          groupKey = siteId:deviceId:STANDALONE
 */

// 3-level severity: CRITICAL (service-affecting) > MEDIUM (degraded) > LOW (sub-optimal)
const SEVERITY_ORDER = ['CRITICAL', 'MEDIUM', 'LOW'];

function getHigherSeverity(a, b) {
  return SEVERITY_ORDER.indexOf(a) <= SEVERITY_ORDER.indexOf(b) ? a : b;
}

// Compute the worst severity from an array of severity strings
function worstSeverity(severities) {
  return severities.reduce(
    (worst, s) => (SEVERITY_ORDER.indexOf(s) < SEVERITY_ORDER.indexOf(worst) ? s : worst),
    'LOW'
  );
}

/**
 * Recompute and persist site.status based on the site's current OPEN events.
 *
 *   CRITICAL open event  → site.status = CRITICAL
 *   MEDIUM / LOW only    → site.status = WARNING
 *   No open events       → site.status = OK
 *
 * This is called after every Rule 1/2/3 create/merge and after auto-close.
 */
async function updateSiteStatus(siteId) {
  if (!siteId) return;

  const openEvents = await prisma.correlatedEvent.findMany({
    where:  { siteId, status: 'OPEN' },
    select: { severity: true },
  });

  let newStatus = 'OK';
  if (openEvents.length > 0) {
    const worst = worstSeverity(openEvents.map((e) => e.severity));
    newStatus = worst === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
  }

  // updateMany silently skips if siteId no longer exists (e.g. orphaned events after a reseed)
  await prisma.site.updateMany({
    where: { id: siteId },
    data:  { status: newStatus },
  });
}

/**
 * Auto-close correlated events older than 15 minutes.
 * This prevents events from accumulating indefinitely and ensures
 * the map/alarms view reflects current network state.
 * After closing, recomputes each affected site's status.
 */
async function autoCloseOldEvents() {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

  const oldOpen = await prisma.correlatedEvent.findMany({
    where:  { status: 'OPEN', startTime: { lt: fifteenMinAgo } },
    select: { id: true, siteId: true },
  });

  if (oldOpen.length === 0) return;

  // Bulk-close all stale events
  await prisma.correlatedEvent.updateMany({
    where: { id: { in: oldOpen.map((e) => e.id) } },
    data:  { status: 'CLOSED' },
  });

  console.log(`[CORRELATE] Auto-closed ${oldOpen.length} stale events (>15 min)`);

  // Recompute status for every affected site
  const affectedSiteIds = [...new Set(oldOpen.map((e) => e.siteId).filter(Boolean))];
  for (const siteId of affectedSiteIds) {
    await updateSiteStatus(siteId);
  }
}

/**
 * Correlate a batch of newly normalized raw alarms.
 * @param {Array} newAlarms - array of saved raw_alarm objects
 */
async function correlateAlarms(newAlarms) {
  if (!newAlarms || newAlarms.length === 0) return;

  // Auto-close stale events first
  await autoCloseOldEvents();

  const fiveMinAgo  = new Date(Date.now() - 5  * 60 * 1000);
  const tenMinAgo   = new Date(Date.now() - 10 * 60 * 1000);

  for (const alarm of newAlarms) {
    const { id, siteId, deviceId, severity, timestamp, networkLayer } = alarm;

    // ── RULE 1: Same site + same device, PREVIOUS alarms within 5 min ────────
    const rule1Key = `${siteId}:${deviceId}`;
    const recentSameDevice = await alarmRepository.findBySiteAndDevice(siteId, deviceId, fiveMinAgo);
    const prevSameDevice   = recentSameDevice.filter((a) => a.id !== id);

    if (prevSameDevice.length >= 1) {
      const existingEvent = await correlationRepository.findOpenByGroupKey(rule1Key);

      if (existingEvent) {
        const mergedAlarmIds    = [...new Set([...existingEvent.alarmIds, id])];
        const escalatedSeverity = getHigherSeverity(existingEvent.severity, severity);

        await correlationRepository.update(existingEvent.id, {
          alarmIds:  mergedAlarmIds,
          severity:  escalatedSeverity,
          endTime:   new Date(),
          updatedAt: new Date(),
        });

        console.log(`[CORRELATE] Rule 1 MERGE → ${rule1Key} (${mergedAlarmIds.length} alarms, ${escalatedSeverity})`);
      } else {
        const alarmIds = recentSameDevice.map((a) => a.id);
        if (!alarmIds.includes(id)) alarmIds.push(id);

        await correlationRepository.create({
          groupKey:        rule1Key,
          alarmIds,
          severity,
          startTime:       new Date(Math.min(...recentSameDevice.map((a) => a.timestamp.getTime()), timestamp.getTime())),
          endTime:         new Date(),
          status:          'OPEN',
          correlationRule: 'RULE_1_SAME_SITE_DEVICE',
          siteId,
          deviceId,
          networkLayer:    networkLayer || 'TRANSPORT',
        });

        console.log(`[CORRELATE] Rule 1 CREATE → ${rule1Key} (${alarmIds.length} alarms, ${severity})`);
      }

      // ✅ FIX: Reflect event severity on the site record
      await updateSiteStatus(siteId);
      continue;
    }

    // ── RULE 2: Same site, multiple CRITICAL/MEDIUM devices within 10 min ────
    const rule2Key     = `${siteId}:MULTI`;
    const siteCritical = await alarmRepository.findBySiteInWindow(siteId, tenMinAgo);
    const otherDevices = [...new Set(siteCritical.filter((a) => a.id !== id && a.deviceId !== deviceId).map((a) => a.deviceId))];

    if (['CRITICAL', 'MEDIUM'].includes(severity) && otherDevices.length >= 1) {
      const allAlarmsInWindow = siteCritical;
      const existingEvent     = await correlationRepository.findOpenByGroupKey(rule2Key);
      const allSeverities     = allAlarmsInWindow.map((a) => a.severity);
      allSeverities.push(severity);
      const actualSeverity    = worstSeverity(allSeverities);

      if (existingEvent) {
        const mergedAlarmIds    = [...new Set([...existingEvent.alarmIds, id])];
        const escalatedSeverity = getHigherSeverity(existingEvent.severity, actualSeverity);

        await correlationRepository.update(existingEvent.id, {
          alarmIds: mergedAlarmIds,
          severity: escalatedSeverity,
          endTime:  new Date(),
        });

        console.log(`[CORRELATE] Rule 2 MERGE → ${rule2Key} (${otherDevices.length + 1} devices, ${escalatedSeverity})`);
      } else {
        const alarmIds = allAlarmsInWindow.map((a) => a.id);
        if (!alarmIds.includes(id)) alarmIds.push(id);

        await correlationRepository.create({
          groupKey:        rule2Key,
          alarmIds,
          severity:        actualSeverity,
          startTime:       new Date(Math.min(...allAlarmsInWindow.map((a) => a.timestamp.getTime()), timestamp.getTime())),
          endTime:         new Date(),
          status:          'OPEN',
          correlationRule: 'RULE_2_SITE_WIDE_CRITICAL',
          siteId,
          deviceId:        'MULTI',
          networkLayer:    networkLayer || 'TRANSPORT',
        });

        console.log(`[CORRELATE] Rule 2 CREATE → ${rule2Key} (site-wide, ${otherDevices.length + 1} devices, ${actualSeverity})`);
      }

      // ✅ FIX: Reflect event severity on the site record
      await updateSiteStatus(siteId);
      continue;
    }

    // ── RULE 3: Standalone alarm – first time seeing this device ─────────────
    const rule3Key           = `${siteId}:${deviceId}:STANDALONE`;
    const existingStandalone = await correlationRepository.findOpenByGroupKey(rule3Key);

    if (existingStandalone) {
      const mergedAlarmIds = [...new Set([...existingStandalone.alarmIds, id])];
      await correlationRepository.update(existingStandalone.id, {
        alarmIds: mergedAlarmIds,
        endTime:  new Date(),
        severity: getHigherSeverity(existingStandalone.severity, severity),
      });
      console.log(`[CORRELATE] Rule 3 MERGE → ${rule3Key} (${severity})`);
    } else {
      await correlationRepository.create({
        groupKey:        rule3Key,
        alarmIds:        [id],
        severity,
        startTime:       timestamp,
        endTime:         timestamp,
        status:          'OPEN',
        correlationRule: 'RULE_3_STANDALONE',
        siteId,
        deviceId,
        networkLayer:    networkLayer || 'TRANSPORT',
      });

      console.log(`[CORRELATE] Rule 3 STANDALONE → ${rule3Key} (${severity})`);
    }

    // ✅ FIX: Reflect event severity on the site record
    await updateSiteStatus(siteId);
  }
}

module.exports = { correlateAlarms };
