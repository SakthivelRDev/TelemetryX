const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const siteRepository = {
  findAll: ({ region, status, networkLayer } = {}) => {
    const where = {};
    if (region)       where.region       = region;
    if (status)       where.status       = status;
    if (networkLayer) where.networkLayer = networkLayer;
    return prisma.site.findMany({ where, orderBy: { name: 'asc' } });
  },

  findById: (id) => prisma.site.findUnique({ where: { id } }),

  findByName: (name) => prisma.site.findFirst({ where: { name } }),

  create: (data) => prisma.site.create({ data }),

  update: (id, data) => prisma.site.update({ where: { id }, data }),

  updateStatus: (id, status) => prisma.site.update({ where: { id }, data: { status } }),

  count: () => prisma.site.count(),

  countByStatus: (status) => prisma.site.count({ where: { status } }),
};

module.exports = siteRepository;
