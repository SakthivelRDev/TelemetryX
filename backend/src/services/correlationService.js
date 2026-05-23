const alarmRepository    = require('../repositories/alarmRepository');
const correlationRepository = require('../repositories/correlationRepository');

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

const SEVERITY_ORDER = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO'];

function getHigherSeverity(a, b) {
  return SEVERITY_ORDER.indexOf(a) <= SEVERITY_ORDER.indexOf(b) ? a : b;
}

/**
 * Correlate a batch of newly normalized raw alarms.
 * @param {Array} newAlarms - array of saved raw_alarm objects (with id, siteId, deviceId, severity, timestamp)
 */
async function correlateAlarms(newAlarms) {
  if (!newAlarms || newAlarms.length === 0) return;

  const fiveMinAgo  = new Date(Date.now() - 5  * 60 * 1000);
  const tenMinAgo   = new Date(Date.now() - 10 * 60 * 1000);

  for (const alarm of newAlarms) {
    const { id, siteId, deviceId, severity, timestamp } = alarm;

    // ── RULE 1: Same site + same device within 5 minutes ──────────────────
    const rule1Key = `${siteId}:${deviceId}`;
    const recentSameDevice = await alarmRepository.findBySiteAndDevice(siteId, deviceId, fiveMinAgo);

    if (recentSameDevice.length >= 1) {
      // Check if there's an open correlated event for this groupKey
      const existingEvent = await correlationRepository.findOpenByGroupKey(rule1Key);

      if (existingEvent) {
        // Merge: add alarm to existing event, escalate severity if needed, update endTime
        const mergedAlarmIds  = [...new Set([...existingEvent.alarmIds, id])];
        const escalatedSeverity = getHigherSeverity(existingEvent.severity, severity);

        await correlationRepository.update(existingEvent.id, {
          alarmIds: mergedAlarmIds,
          severity: escalatedSeverity,
          endTime:  new Date(),
          updatedAt: new Date(),
        });

        console.log(`[CORRELATE] Rule 1 MERGE → ${rule1Key} (${mergedAlarmIds.length} alarms, ${escalatedSeverity})`);
        continue;
      } else {
        // Create new event under Rule 1
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
        });

        console.log(`[CORRELATE] Rule 1 CREATE → ${rule1Key} (${alarmIds.length} alarms, ${severity})`);
        continue;
      }
    }

    // ── RULE 2: Same site, multiple CRITICAL/MAJOR devices within 10 min ──
    if (['CRITICAL', 'MAJOR'].includes(severity)) {
      const rule2Key  = `${siteId}:MULTI`;
      const siteCritical = await alarmRepository.findBySiteInWindow(siteId, tenMinAgo);

      // Need at least 2 different devices
      const uniqueDevices = [...new Set(siteCritical.map((a) => a.deviceId))];
      if (uniqueDevices.length >= 2) {
        const existingEvent = await correlationRepository.findOpenByGroupKey(rule2Key);

        if (existingEvent) {
          const mergedAlarmIds = [...new Set([...existingEvent.alarmIds, id])];
          const escalatedSeverity = getHigherSeverity(existingEvent.severity, severity);

          await correlationRepository.update(existingEvent.id, {
            alarmIds: mergedAlarmIds,
            severity: escalatedSeverity,
            endTime:  new Date(),
          });

          console.log(`[CORRELATE] Rule 2 MERGE → ${rule2Key} (${uniqueDevices.length} devices, ${escalatedSeverity})`);
        } else {
          const alarmIds = siteCritical.map((a) => a.id);
          if (!alarmIds.includes(id)) alarmIds.push(id);

          await correlationRepository.create({
            groupKey:        rule2Key,
            alarmIds,
            severity:        'CRITICAL',
            startTime:       new Date(Math.min(...siteCritical.map((a) => a.timestamp.getTime()))),
            endTime:         new Date(),
            status:          'OPEN',
            correlationRule: 'RULE_2_SITE_WIDE_CRITICAL',
            siteId,
            deviceId:        'MULTI',
          });

          console.log(`[CORRELATE] Rule 2 CREATE → ${rule2Key} (site-wide, ${uniqueDevices.length} devices)`);
        }
        continue;
      }
    }

    // ── RULE 3: Standalone alarm – no match found ──────────────────────────
    const rule3Key = `${siteId}:${deviceId}:STANDALONE`;
    const existingStandalone = await correlationRepository.findOpenByGroupKey(rule3Key);

    if (existingStandalone) {
      // Absorb into existing standalone event
      const mergedAlarmIds = [...new Set([...existingStandalone.alarmIds, id])];
      await correlationRepository.update(existingStandalone.id, {
        alarmIds: mergedAlarmIds,
        endTime:  new Date(),
      });
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
      });

      console.log(`[CORRELATE] Rule 3 STANDALONE → ${rule3Key} (${severity})`);
    }
  }
}

module.exports = { correlateAlarms };
