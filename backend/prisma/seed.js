const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── 1. USERS ──────────────────────────────────────────────────────────────
  const adminPass = await bcrypt.hash('admin123', 10);
  const engPass   = await bcrypt.hash('eng123', 10);
  const viewPass  = await bcrypt.hash('view123', 10);

  const admin    = await prisma.user.upsert({ where: { email: 'admin@app360.com' },    update: {}, create: { name: 'Super Admin',      email: 'admin@app360.com',    password: adminPass, role: 'ADMIN'    } });
  const engineer = await prisma.user.upsert({ where: { email: 'engineer@app360.com' }, update: {}, create: { name: 'Field Engineer',    email: 'engineer@app360.com', password: engPass,   role: 'ENGINEER' } });
  const viewer   = await prisma.user.upsert({ where: { email: 'viewer@app360.com' },   update: {}, create: { name: 'Dashboard Viewer', email: 'viewer@app360.com',   password: viewPass,  role: 'VIEWER'   } });

  console.log(`✅ Users: ${admin.email}, ${engineer.email}, ${viewer.email}`);

  // ── 2. PERMISSIONS ────────────────────────────────────────────────────────
  await prisma.permission.deleteMany({});

  await prisma.permission.createMany({
    data: [
      // ADMIN – full access
      { role: 'ADMIN', module: 'ALARM', canRead: true, canWrite: true, canDelete: true },
      { role: 'ADMIN', module: 'MAP',   canRead: true, canWrite: true, canDelete: true },
      { role: 'ADMIN', module: 'API',   canRead: true, canWrite: true, canDelete: true },
      { role: 'ADMIN', module: 'USER',  canRead: true, canWrite: true, canDelete: true },
      { role: 'ADMIN', module: 'PROFILE',  canRead: true, canWrite: true, canDelete: true },
      // ENGINEER – read/write alarms, read map & api & user; Region View enabled (canWrite on MAP)
      { role: 'ENGINEER', module: 'ALARM', canRead: true,  canWrite: true,  canDelete: false },
      { role: 'ENGINEER', module: 'MAP',   canRead: true,  canWrite: true,  canDelete: false },
      { role: 'ENGINEER', module: 'API',   canRead: true,  canWrite: false, canDelete: false },
      { role: 'ENGINEER', module: 'USER',  canRead: true,  canWrite: false, canDelete: false },
      { role: 'ENGINEER', module: 'PROFILE',  canRead: true,  canWrite: true, canDelete: false },
      // VIEWER – read only alarms & map; Region View disabled by default (toggle in matrix to enable)
      { role: 'VIEWER', module: 'ALARM', canRead: true,  canWrite: false, canDelete: false },
      { role: 'VIEWER', module: 'MAP',   canRead: true,  canWrite: false, canDelete: false },
      { role: 'VIEWER', module: 'API',   canRead: false, canWrite: false, canDelete: false },
      { role: 'VIEWER', module: 'USER',  canRead: false, canWrite: false, canDelete: false },
      { role: 'VIEWER', module: 'PROFILE',  canRead: true, canWrite: true, canDelete: false },
    ],
  });
  console.log('✅ Permissions seeded');

  // ── 3. SITES – India with RAN / CORE / TRANSPORT layers ──────────────────
  await prisma.site.deleteMany({});

  await prisma.site.createMany({
    data: [
      // ── CORE sites (5G Core, 4G EPC) ──────────────────────────────────────
      { name: 'Mumbai Core DC',     region: 'West',  lat: 19.0760, lng: 72.8777, networkLayer: 'CORE',      status: 'OK'       },
      { name: 'Bangalore Core DC',  region: 'South', lat: 12.9716, lng: 77.5946, networkLayer: 'CORE',      status: 'OK'       },
      { name: 'Hyderabad Core DC',  region: 'South', lat: 17.3850, lng: 78.4867, networkLayer: 'CORE',      status: 'OK'       },
      { name: 'Delhi Core Hub',     region: 'North', lat: 28.6139, lng: 77.2090, networkLayer: 'CORE',      status: 'OK'       },
      // ── TRANSPORT sites (Backhaul / Fronthaul) ────────────────────────────
      { name: 'Chennai Transport',  region: 'South', lat: 13.0827, lng: 80.2707, networkLayer: 'TRANSPORT', status: 'OK'       },
      { name: 'Kolkata Ring Node',  region: 'East',  lat: 22.5726, lng: 88.3639, networkLayer: 'TRANSPORT', status: 'OK'       },
      { name: 'Pune Backhaul Hub',  region: 'West',  lat: 18.5204, lng: 73.8567, networkLayer: 'TRANSPORT', status: 'OK'       },
      { name: 'Ahmedabad Transit',  region: 'West',  lat: 23.0225, lng: 72.5714, networkLayer: 'TRANSPORT', status: 'OK'       },
      // ── RAN sites (Base Stations / Cell Towers) ───────────────────────────
      { name: 'Mumbai RAN North',   region: 'West',  lat: 19.1663, lng: 72.9311, networkLayer: 'RAN',       status: 'OK'       },
      { name: 'Mumbai RAN South',   region: 'West',  lat: 18.9388, lng: 72.8354, networkLayer: 'RAN',       status: 'OK'       },
      { name: 'Delhi RAN Central',  region: 'North', lat: 28.7041, lng: 77.1025, networkLayer: 'RAN',       status: 'OK'       },
      { name: 'Bangalore RAN East', region: 'South', lat: 13.0012, lng: 77.7032, networkLayer: 'RAN',       status: 'OK'       },
      { name: 'Chennai RAN Grid',   region: 'South', lat: 13.1500, lng: 80.3000, networkLayer: 'RAN',       status: 'OK'       },
    ],
  });
  console.log('✅ Sites seeded: 4 CORE, 4 TRANSPORT, 5 RAN sites');

  // ── 4. API SOURCES ────────────────────────────────────────────────────────
  await prisma.apiSource.deleteMany({});
  await prisma.apiSource.createMany({
    data: [
      { name: 'Source A – EMS/NMS Trap Sim', url: 'mock://sourceA', type: 'MOCK', status: 'ACTIVE' },
      { name: 'Source B – OSS REST Poller',  url: 'mock://sourceB', type: 'MOCK', status: 'ACTIVE' },
    ],
  });
  console.log('✅ API sources seeded');

  // ── 5. SEED INITIAL RAW ALARMS (3-level severity, layer-aware) ─────────────
  const siteList = await prisma.site.findMany();

  // Layer-specific device IDs
  const LAYER_DEVICES = {
    RAN:       ['gNodeB-01', 'eNodeB-01', 'CU-01', 'DU-01', 'RRU-01', 'Antenna-01'],
    CORE:      ['AMF-01',    'SMF-01',    'UPF-01', 'MME-01', 'SGW-01', 'PCF-01'],
    TRANSPORT: ['RTR-01',    'RTR-02',    'SW-01',  'OTN-01', 'MW-01',  'FW-01'],
  };

  // Layer-specific alarm messages
  const LAYER_MESSAGES = {
    RAN: [
      'Cell outage – RF signal loss',
      'Handover failure detected',
      'RACH congestion – uplink overload',
      'Interference detected on carrier',
      'gNodeB connectivity lost',
      'CU-DU split interface failure',
      'Antenna tilting misalignment',
      'Radio link failure – UE disconnected',
    ],
    CORE: [
      'AMF registration failure – UE unreachable',
      'SMF session establishment dropped',
      'UPF data plane congestion',
      'MME authentication failure – HLR timeout',
      'HSS subscriber data fetch error',
      'PCF policy push failure',
      'SGW-PGW tunnel collapse',
      'Core node CPU overload – session drops',
    ],
    TRANSPORT: [
      'Backhaul link down – fiber cut detected',
      'BGP peer session reset',
      'Packet loss above threshold – 8%',
      'OTN transponder failure',
      'Microwave link degraded – rain fade',
      'MPLS LSP rerouted',
      'Switch port flapping',
      'Firewall policy mismatch',
    ],
  };

  const SEVERITIES = ['CRITICAL', 'CRITICAL', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'LOW', 'LOW', 'LOW'];
  const now = new Date();
  const rawAlarms = [];

  for (const site of siteList) {
    const layer = site.networkLayer || 'TRANSPORT';
    const devices  = LAYER_DEVICES[layer];
    const messages = LAYER_MESSAGES[layer];

    for (let i = 0; i < 3; i++) {
      rawAlarms.push({
        source:       Math.random() > 0.5 ? 'sourceA' : 'sourceB',
        siteId:       site.id,
        deviceId:     devices[Math.floor(Math.random() * devices.length)],
        severity:     SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)],
        message:      messages[Math.floor(Math.random() * messages.length)],
        timestamp:    new Date(now.getTime() - Math.random() * 5 * 60 * 1000),
        normalized:   true,
        networkLayer: layer,
      });
    }
  }

  await prisma.rawAlarm.createMany({ data: rawAlarms });
  console.log(`✅ ${rawAlarms.length} initial raw alarms seeded`);

  // ── 6. SEED INITIAL CORRELATED EVENTS ─────────────────────────────────────
  const SEVERITY_ORDER = ['CRITICAL', 'MEDIUM', 'LOW'];

  for (const site of siteList) {
    const dbAlarms = await prisma.rawAlarm.findMany({ where: { siteId: site.id }, take: 3 });
    if (dbAlarms.length === 0) continue;

    const topSeverity = dbAlarms.reduce((worst, a) =>
      SEVERITY_ORDER.indexOf(a.severity) < SEVERITY_ORDER.indexOf(worst) ? a.severity : worst, 'LOW'
    );

    const grouped = {};
    dbAlarms.forEach((a) => {
      const key = `${a.siteId}:${a.deviceId}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a.id);
    });

    for (const [groupKey, ids] of Object.entries(grouped)) {
      const deviceId = groupKey.split(':')[1];
      const alarm0   = dbAlarms.find((a) => a.deviceId === deviceId);
      await prisma.correlatedEvent.create({
        data: {
          groupKey,
          alarmIds:        ids,
          severity:        topSeverity,
          startTime:       new Date(now.getTime() - 4 * 60 * 1000),
          endTime:         now,
          status:          'OPEN',
          correlationRule: 'RULE_1_SAME_SITE_DEVICE',
          siteId:          site.id,
          deviceId,
          networkLayer:    site.networkLayer || 'TRANSPORT',
        },
      });
    }
  }

  console.log('✅ Correlated events seeded');
  console.log('\n🎉 Seed complete!');
  console.log('   admin@app360.com    / admin123  (ADMIN)');
  console.log('   engineer@app360.com / eng123    (ENGINEER)');
  console.log('   viewer@app360.com   / view123   (VIEWER)');
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
