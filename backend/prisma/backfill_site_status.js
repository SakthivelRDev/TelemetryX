/**
 * One-shot backfill: recompute site.status from currently open correlated events.
 * Run once after deploying the correlationService fix.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SEV_ORDER = ['CRITICAL', 'MEDIUM', 'LOW'];
function worstSeverity(sevs) {
  return sevs.reduce((b, x) => SEV_ORDER.indexOf(x) < SEV_ORDER.indexOf(b) ? x : b, 'LOW');
}

async function main() {
  const sites = await prisma.site.findMany({ select: { id: true, name: true } });
  let fixed = 0;

  for (const site of sites) {
    const openEvents = await prisma.correlatedEvent.findMany({
      where:  { siteId: site.id, status: 'OPEN' },
      select: { severity: true },
    });

    let newStatus = 'OK';
    if (openEvents.length > 0) {
      const worst = worstSeverity(openEvents.map((e) => e.severity));
      newStatus = worst === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
    }

    await prisma.site.update({ where: { id: site.id }, data: { status: newStatus } });
    if (newStatus !== 'OK') {
      console.log(`  ${site.name} → ${newStatus} (${openEvents.length} open events)`);
      fixed++;
    }
  }

  console.log(`\n✅ Backfill complete: ${sites.length} sites checked, ${fixed} set to non-OK`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
