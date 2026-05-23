const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const apiSourceRepository = {
  findAll: () => prisma.apiSource.findMany({ orderBy: { name: 'asc' } }),

  findById: (id) => prisma.apiSource.findUnique({ where: { id } }),

  create: (data) => prisma.apiSource.create({ data }),

  updatePolled: (id) =>
    prisma.apiSource.update({
      where: { id },
      data: { lastPolledAt: new Date(), status: 'ACTIVE' },
    }),

  updateStatus: (id, status) => prisma.apiSource.update({ where: { id }, data: { status } }),

  delete: (id) => prisma.apiSource.delete({ where: { id } }),
};

module.exports = apiSourceRepository;
