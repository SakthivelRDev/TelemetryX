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

  getCorrelatedEvents: async ({ page, limit, severity, status, siteId, region, networkLayer } = {}) => {
    const where = {
      ...(severity     && { severity }),
      ...(status       && { status }),
      ...(siteId       && { siteId }),
      ...(networkLayer && { networkLayer }),
    };

    let regionSiteIds = [];
    if (!siteId && region) {
      const sitesInRegion = await prisma.site.findMany({
        where: { region },
        select: { id: true },
      });
      regionSiteIds = sitesInRegion.map((s) => s.id);
      if (regionSiteIds.length === 0) {
        return { events: [], total: 0, page, limit };
      }
      where.siteId = { in: regionSiteIds };
    }

    const [events, total] = await Promise.all([
      correlationRepository.findAll({ page, limit, severity, status, siteId, siteIds: regionSiteIds, networkLayer }),
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

  getDashboardStats: async (range = 'all') => {
    // Build timestamp filter for rawAlarm queries
    const RANGE_MS = {
      '1h':  1 * 60 * 60 * 1000,
      '6h':  6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d':  7 * 24 * 60 * 60 * 1000,
    };

    const cutoff = range !== 'all' && RANGE_MS[range]
      ? new Date(Date.now() - RANGE_MS[range])
      : null;

    // rawAlarm timestamp filter (empty = no restriction)
    const timeFilter = cutoff ? { timestamp: { gte: cutoff } } : {};

    // correlatedEvent startTime filter
    const eventTimeFilter = cutoff ? { startTime: { gte: cutoff } } : {};

    const [totalRaw, openEvents, allSites] = await Promise.all([
      prisma.rawAlarm.count({ where: timeFilter }),
      prisma.correlatedEvent.count({ where: { status: 'OPEN', ...eventTimeFilter } }),
      prisma.site.findMany({ select: { id: true, status: true, networkLayer: true } }),
    ]);

    // criticalSites: if a range is active, count distinct sites that had a CRITICAL alarm in the window
    // otherwise fall back to current site.status
    let criticalSites;
    if (cutoff) {
      const critRows = await prisma.rawAlarm.findMany({
        where: { severity: 'CRITICAL', timestamp: { gte: cutoff } },
        select: { siteId: true },
        distinct: ['siteId'],
      });
      criticalSites = critRows.filter((r) => r.siteId).length;
    } else {
      criticalSites = allSites.filter((s) => s.status === 'CRITICAL').length;
    }

    // Severity breakdown (3-level)
    const severities = ['CRITICAL', 'MEDIUM', 'LOW'];
    const severityCounts = {};
    for (const s of severities) {
      severityCounts[s] = await prisma.rawAlarm.count({
        where: { ...timeFilter, severity: s },
      });
    }

    // Site status breakdown
    const siteStatuses = {
      CRITICAL: allSites.filter((s) => s.status === 'CRITICAL').length,
      WARNING:  allSites.filter((s) => s.status === 'WARNING').length,
      OK:       allSites.filter((s) => s.status === 'OK').length,
    };

    const layerCounts = {
      RAN:       allSites.filter((s) => s.networkLayer === 'RAN').length,
      CORE:      allSites.filter((s) => s.networkLayer === 'CORE').length,
      TRANSPORT: allSites.filter((s) => s.networkLayer === 'TRANSPORT').length,
    };

    const layerSeverityCounts = {};
    const layers = ['RAN', 'CORE', 'TRANSPORT'];
    for (const layer of layers) {
      layerSeverityCounts[layer] = {};
      for (const severity of severities) {
        layerSeverityCounts[layer][severity] = await prisma.rawAlarm.count({
          where: {
            ...timeFilter,
            networkLayer: layer,
            severity,
          },
        });
      }
    }

    return {
      totalRaw,
      openEvents,
      criticalSites,
      criticalAlarms: severityCounts.CRITICAL,
      severityCounts,
      siteStatuses,
      layerCounts,
      layerSeverityCounts,
    };
  },

  // Returns alarm counts grouped by time bucket for a configurable range
  getAlarmTimeSeries: async (range = '12h', networkLayer = null) => {
    const RANGE_CONFIG = {
      '1h':  { buckets: 12, msPerBucket: 5 * 60 * 1000,         label: (d) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}` },
      '6h':  { buckets: 6,  msPerBucket: 60 * 60 * 1000,         label: (d) => `${d.getHours().toString().padStart(2, '0')}:00` },
      '12h': { buckets: 12, msPerBucket: 60 * 60 * 1000,         label: (d) => `${d.getHours().toString().padStart(2, '0')}:00` },
      '24h': { buckets: 24, msPerBucket: 60 * 60 * 1000,         label: (d) => `${d.getHours().toString().padStart(2, '0')}:00` },
      '7d':  { buckets: 7,  msPerBucket: 24 * 60 * 60 * 1000,    label: (d) => d.toLocaleDateString('en-IN', { weekday: 'short' }) },
    };

    const now = new Date();
    let config = RANGE_CONFIG[range] || RANGE_CONFIG['12h'];

    if (range === 'all') {
      const firstAlarm = await prisma.rawAlarm.findFirst({
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      });

      if (!firstAlarm?.timestamp) {
        return { series: [], range };
      }

      const spanMs = Math.max(now.getTime() - firstAlarm.timestamp.getTime(), 60 * 60 * 1000);
      const targetBuckets = 30;
      const bucketMs = Math.max(Math.ceil(spanMs / targetBuckets), 60 * 60 * 1000);

      config = {
        buckets: Math.min(targetBuckets, Math.ceil(spanMs / bucketMs)),
        msPerBucket: bucketMs,
        label: (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      };
    }

    const series = [];

    for (let i = config.buckets - 1; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * config.msPerBucket);
      const end   = new Date(now.getTime() - i * config.msPerBucket);
      const label = config.label(end);

      // Build base where clause for timestamp and optional networkLayer
      const baseWhere = { timestamp: { gte: start, lt: end } };
      if (networkLayer) baseWhere.networkLayer = networkLayer;

      const [total, critical, medium, low] = await Promise.all([
        prisma.rawAlarm.count({ where: baseWhere }),
        prisma.rawAlarm.count({ where: { ...baseWhere, severity: 'CRITICAL' } }),
        prisma.rawAlarm.count({ where: { ...baseWhere, severity: 'MEDIUM'   } }),
        prisma.rawAlarm.count({ where: { ...baseWhere, severity: 'LOW'      } }),
      ]);

      series.push({ hour: label, total, critical, medium, low });
    }

    return { series, range };
  },
};

module.exports = alarmService;

