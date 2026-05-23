const alarmRepository       = require('../repositories/alarmRepository');
const correlationRepository = require('../repositories/correlationRepository');
const { PrismaClient }      = require('@prisma/client');
const prisma                = new PrismaClient();

function formatGroupKeyLabel(groupKey, siteName) {
  if (!groupKey) return '—';
  const parts     = groupKey.split(':');
  const siteLabel = siteName || `Site ${parts[0]?.slice(0, 8)}…`;

  if (parts[1] === 'MULTI') return `${siteLabel} · Site-wide (multiple devices)`;
  if (parts[2] === 'STANDALONE') return `${siteLabel} · ${parts[1]} (single alarm)`;
  if (parts.length >= 2) return `${siteLabel} · Device ${parts[1]}`;
  return groupKey;
}

const alarmService = {
  getRawAlarms: async ({ page, limit, severity, siteId, source } = {}) => {
    const [alarms, total] = await Promise.all([
      alarmRepository.findAll({ page, limit, severity, siteId, source }),
      alarmRepository.count({ ...(severity && { severity }), ...(siteId && { siteId }) }),
    ]);
    return { alarms, total, page, limit };
  },

  getRawAlarmById: async (id) => {
    const alarm = await alarmRepository.findById(id);
    if (!alarm) throw new Error('Alarm not found');
    return alarm;
  },

  getCorrelatedEvents: async ({ page, limit, severity, status, siteId, networkLayer } = {}) => {
    const where = {
      ...(severity     && { severity }),
      ...(status       && { status }),
      ...(siteId       && { siteId }),
      ...(networkLayer && { networkLayer }),
    };

    const [events, total] = await Promise.all([
      correlationRepository.findAll({ page, limit, severity, status, siteId, networkLayer }),
      correlationRepository.count(where),
    ]);

    const siteIds = [...new Set(events.map((e) => e.siteId).filter(Boolean))];
    const sites   = siteIds.length
      ? await prisma.site.findMany({ where: { id: { in: siteIds } }, select: { id: true, name: true } })
      : [];
    const siteNames = Object.fromEntries(sites.map((s) => [s.id, s.name]));

    const enriched = events.map((e) => ({
      ...e,
      siteName:      siteNames[e.siteId] || null,
      groupKeyLabel: formatGroupKeyLabel(e.groupKey, siteNames[e.siteId]),
    }));

    return { events: enriched, total, page, limit };
  },

  getCorrelatedEventById: async (id) => {
    const event = await correlationRepository.findById(id);
    if (!event) throw new Error('Correlated event not found');

    // Fetch the actual raw alarms for drill-down
    const rawAlarms = await prisma.rawAlarm.findMany({
      where: { id: { in: event.alarmIds } },
      orderBy: { timestamp: 'desc' },
    });

    // Fetch site info
    const site = await prisma.site.findUnique({ where: { id: event.siteId } });

    return { ...event, rawAlarms, site };
  },

  getDashboardStats: async () => {
    const [totalRaw, openEvents, criticalSites, allSites] = await Promise.all([
      alarmRepository.count(),
      correlationRepository.countOpen(),
      prisma.site.count({ where: { status: 'CRITICAL' } }),
      prisma.site.findMany({ select: { status: true } }),
    ]);

    // Severity breakdown (3-level)
    const severities = ['CRITICAL', 'MEDIUM', 'LOW'];
    const severityCounts = {};
    for (const s of severities) {
      severityCounts[s] = await alarmRepository.countBySeverity(s);
    }

    // Site status breakdown
    const siteStatuses = {
      CRITICAL: allSites.filter((s) => s.status === 'CRITICAL').length,
      WARNING:  allSites.filter((s) => s.status === 'WARNING').length,
      OK:       allSites.filter((s) => s.status === 'OK').length,
    };

    return {
      totalRaw,
      openEvents,
      criticalSites,
      criticalAlarms: severityCounts.CRITICAL,
      severityCounts,
      siteStatuses,
    };
  },

  // Returns alarm counts grouped by time bucket for a configurable range
  getAlarmTimeSeries: async (range = '12h') => {
    const RANGE_CONFIG = {
      '1h':  { buckets: 12, msPerBucket: 5 * 60 * 1000,        label: (d) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}` },
      '6h':  { buckets: 6,  msPerBucket: 60 * 60 * 1000,         label: (d) => `${d.getHours().toString().padStart(2, '0')}:00` },
      '12h': { buckets: 12, msPerBucket: 60 * 60 * 1000,        label: (d) => `${d.getHours().toString().padStart(2, '0')}:00` },
      '24h': { buckets: 24, msPerBucket: 60 * 60 * 1000,        label: (d) => `${d.getHours().toString().padStart(2, '0')}:00` },
      '7d':  { buckets: 7,  msPerBucket: 24 * 60 * 60 * 1000,   label: (d) => d.toLocaleDateString('en-IN', { weekday: 'short' }) },
    };

    const config = RANGE_CONFIG[range] || RANGE_CONFIG['12h'];
    const now    = new Date();
    const series = [];

    for (let i = config.buckets - 1; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * config.msPerBucket);
      const end   = new Date(now.getTime() - i * config.msPerBucket);
      const label = config.label(end);

      const [total, critical, medium, low] = await Promise.all([
        prisma.rawAlarm.count({ where: { timestamp: { gte: start, lt: end } } }),
        prisma.rawAlarm.count({ where: { timestamp: { gte: start, lt: end }, severity: 'CRITICAL' } }),
        prisma.rawAlarm.count({ where: { timestamp: { gte: start, lt: end }, severity: 'MEDIUM'   } }),
        prisma.rawAlarm.count({ where: { timestamp: { gte: start, lt: end }, severity: 'LOW'      } }),
      ]);

      series.push({ hour: label, total, critical, medium, low });
    }

    return { series, range };
  },
};

module.exports = alarmService;

