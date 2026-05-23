const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── 1. USERS ──────────────────────────────────────────────────────────────
  const adminPass = await bcrypt.hash('admin123', 10);
  const engPass = await bcrypt.hash('eng123', 10);
  const viewPass = await bcrypt.hash('view123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@app360.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@app360.com',
      password: adminPass,
      role: 'ADMIN',
    },
  });

  const engineer = await prisma.user.upsert({
    where: { email: 'engineer@app360.com' },
    update: {},
    create: {
      name: 'Field Engineer',
      email: 'engineer@app360.com',
      password: engPass,
      role: 'ENGINEER',
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@app360.com' },
    update: {},
    create: {
      name: 'Dashboard Viewer',
      email: 'viewer@app360.com',
      password: viewPass,
      role: 'VIEWER',
    },
  });

  console.log(`✅ Users created: ${admin.email}, ${engineer.email}, ${viewer.email}`);

  // ── 2. PERMISSIONS ────────────────────────────────────────────────────────
  const modules = ['ALARM', 'MAP', 'API', 'USER'];

  // Delete existing to avoid conflicts
  await prisma.permission.deleteMany({});

  const permissionSeed = [
    // ADMIN – full access to everything
    ...modules.map((m) => ({ role: 'ADMIN', module: m, canRead: true, canWrite: true, canDelete: true })),
    // ENGINEER – read/write alarm & map, read api, no user access
    { role: 'ENGINEER', module: 'ALARM', canRead: true, canWrite: true, canDelete: false },
    { role: 'ENGINEER', module: 'MAP',   canRead: true, canWrite: false, canDelete: false },
    { role: 'ENGINEER', module: 'API',   canRead: true, canWrite: false, canDelete: false },
    { role: 'ENGINEER', module: 'USER',  canRead: false, canWrite: false, canDelete: false },
    // VIEWER – read only alarm & map, no api, no user
    { role: 'VIEWER', module: 'ALARM', canRead: true, canWrite: false, canDelete: false },
    { role: 'VIEWER', module: 'MAP',   canRead: true, canWrite: false, canDelete: false },
    { role: 'VIEWER', module: 'API',   canRead: false, canWrite: false, canDelete: false },
    { role: 'VIEWER', module: 'USER',  canRead: false, canWrite: false, canDelete: false },
  ];

  await prisma.permission.createMany({ data: permissionSeed });
  console.log('✅ Permissions seeded');

  // ── 3. SITES (India) ─────────────────────────────────────────────────────
  await prisma.site.deleteMany({});

  const sites = await prisma.site.createMany({
    data: [
      { name: 'Mumbai NOC',     region: 'West',  lat: 19.0760, lng: 72.8777, status: 'CRITICAL' },
      { name: 'Delhi Hub',      region: 'North', lat: 28.6139, lng: 77.2090, status: 'WARNING'  },
      { name: 'Bangalore Core', region: 'South', lat: 12.9716, lng: 77.5946, status: 'OK'       },
      { name: 'Chennai Edge',   region: 'South', lat: 13.0827, lng: 80.2707, status: 'OK'       },
      { name: 'Kolkata Ring',   region: 'East',  lat: 22.5726, lng: 88.3639, status: 'WARNING'  },
      { name: 'Hyderabad DC',   region: 'South', lat: 17.3850, lng: 78.4867, status: 'CRITICAL' },
      { name: 'Pune Relay',     region: 'West',  lat: 18.5204, lng: 73.8567, status: 'OK'       },
    ],
  });
  console.log(`✅ Sites seeded: ${sites.count} sites in India`);

  // ── 4. API SOURCES ────────────────────────────────────────────────────────
  await prisma.apiSource.deleteMany({});

  await prisma.apiSource.createMany({
    data: [
      { name: 'Source A – SNMP Trap Sim', url: 'mock://sourceA', type: 'MOCK', status: 'ACTIVE' },
      { name: 'Source B – REST Poller',   url: 'mock://sourceB', type: 'MOCK', status: 'ACTIVE' },
    ],
  });
  console.log('✅ API sources seeded');

  // ── 5. SEED INITIAL RAW ALARMS ────────────────────────────────────────────
  const siteList = await prisma.site.findMany();
  const siteMap = {};
  siteList.forEach((s) => (siteMap[s.name] = s.id));

  const devices = ['RTR-01', 'RTR-02', 'SW-01', 'SW-02', 'FW-01'];
  const severities = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO'];
  const messages = [
    'Link down detected',
    'High CPU utilization',
    'Memory threshold exceeded',
    'Packet loss above 5%',
    'Interface flapping',
    'BGP session dropped',
    'Power supply fault',
    'Temperature warning',
  ];

  const rawAlarms = [];
  const now = new Date();

  for (const site of siteList) {
    for (let i = 0; i < 4; i++) {
      const device = devices[Math.floor(Math.random() * devices.length)];
      const severity = severities[Math.floor(Math.random() * 3)]; // bias toward critical
      const message = messages[Math.floor(Math.random() * messages.length)];
      const timestamp = new Date(now.getTime() - Math.random() * 5 * 60 * 1000); // within last 5 min
      const source = Math.random() > 0.5 ? 'sourceA' : 'sourceB';

      rawAlarms.push({
        source,
        siteId: site.id,
        deviceId: device,
        severity,
        message,
        timestamp,
        normalized: true,
      });
    }
  }

  await prisma.rawAlarm.createMany({ data: rawAlarms });
  console.log(`✅ ${rawAlarms.length} initial raw alarms seeded`);

  // ── 6. SEED INITIAL CORRELATED EVENTS ─────────────────────────────────────
  // Simple grouping for seed: per site, create one event
  for (const site of siteList) {
    const siteAlarms = rawAlarms.filter((a) => a.siteId === site.id);
    if (siteAlarms.length === 0) continue;

    const dbAlarms = await prisma.rawAlarm.findMany({
      where: { siteId: site.id },
      take: 4,
    });

    const alarmIds = dbAlarms.map((a) => a.id);
    const severityOrder = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO'];
    const topSeverity = dbAlarms.reduce((acc, a) => {
      return severityOrder.indexOf(a.severity) < severityOrder.indexOf(acc)
        ? a.severity
        : acc;
    }, 'INFO');

    const grouped = {};
    dbAlarms.forEach((a) => {
      const key = `${a.siteId}:${a.deviceId}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a.id);
    });

    for (const [groupKey, ids] of Object.entries(grouped)) {
      const parts = groupKey.split(':');
      const deviceId = parts[1];
      await prisma.correlatedEvent.create({
        data: {
          groupKey,
          alarmIds: ids,
          severity: topSeverity,
          startTime: new Date(now.getTime() - 4 * 60 * 1000),
          endTime: now,
          status: 'OPEN',
          correlationRule: 'RULE_1_SAME_SITE_DEVICE',
          siteId: site.id,
          deviceId,
        },
      });
    }
  }

  console.log('✅ Correlated events seeded');
  console.log('\n🎉 Seed complete! Login credentials:');
  console.log('   admin@app360.com    / admin123  (ADMIN)');
  console.log('   engineer@app360.com / eng123    (ENGINEER)');
  console.log('   viewer@app360.com   / view123   (VIEWER)');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
