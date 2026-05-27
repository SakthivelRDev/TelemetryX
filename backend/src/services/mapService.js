const siteRepository        = require('../repositories/siteRepository');
const correlationRepository = require('../repositories/correlationRepository');
const { PrismaClient }      = require('@prisma/client');
const prisma                = new PrismaClient();

const mapService = {
  getAllSites: async ({ region, severity, status, networkLayer } = {}) => {
    const sites = await siteRepository.findAll({
      region,
      status,
      ...(networkLayer && { networkLayer }),
    });

    // Enrich each site with alarm counts
    const enriched = await Promise.all(
      sites.map(async (site) => {
        const [openEvents, alarmCount] = await Promise.all([
          prisma.correlatedEvent.findMany({
            where: { siteId: site.id, status: 'OPEN' },
            orderBy: { severity: 'asc' },
            take: 1,
          }),
          prisma.rawAlarm.count({ where: { siteId: site.id } }),
        ]);

        const topSeverity = openEvents[0]?.severity || null;
        return { ...site, alarmCount, topSeverity };
      })
    );

    // Filter by severity if requested
    if (severity) {
      return enriched.filter((s) => s.topSeverity === severity);
    }

    return enriched;
  },

  getSiteById: async (id) => {
    const site = await siteRepository.findById(id);
    if (!site) throw new Error('Site not found');

    const [openEvents, recentAlarms, totalAlarms] = await Promise.all([
      prisma.correlatedEvent.findMany({
        where: { siteId: id, status: 'OPEN' },
        orderBy: { startTime: 'desc' },
        take: 5,
      }),
      prisma.rawAlarm.findMany({
        where: { siteId: id },
        orderBy: { timestamp: 'desc' },
        take: 10,
      }),
      prisma.rawAlarm.count({ where: { siteId: id } }),
    ]);

    const severityCounts = await prisma.rawAlarm.groupBy({
      by: ['severity'],
      where: { siteId: id },
      _count: { severity: true },
    });

    return { ...site, openEvents, recentAlarms, totalAlarms, severityCounts };
  },
};

module.exports = mapService;
