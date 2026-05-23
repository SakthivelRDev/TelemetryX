/**
 * Mock Alarm Generator
 * Simulates two external REST API sources with different raw data formats.
 * sourceA: SNMP-trap-style format
 * sourceB: REST-API-style format
 *
 * Severity distribution (realistic network operations):
 *   INFO     40%  – routine notifications
 *   WARNING  25%  – early warning signals
 *   MINOR    15%  – minor degradation
 *   MAJOR    12%  – significant impact
 *   CRITICAL  8%  – service-affecting outage
 */

const { v4: uuidv4 } = require('uuid');

// Indian site names matching DB seed
const SITES = [
  { siteId: 'mumbai-noc',     siteName: 'Mumbai NOC'    },
  { siteId: 'delhi-hub',      siteName: 'Delhi Hub'      },
  { siteId: 'bangalore-core', siteName: 'Bangalore Core' },
  { siteId: 'chennai-edge',   siteName: 'Chennai Edge'   },
  { siteId: 'kolkata-ring',   siteName: 'Kolkata Ring'   },
  { siteId: 'hyderabad-dc',   siteName: 'Hyderabad DC'   },
  { siteId: 'pune-relay',     siteName: 'Pune Relay'     },
];

const DEVICES = ['RTR-01', 'RTR-02', 'SW-01', 'SW-02', 'FW-01', 'LNK-01'];

// Weighted severity picker: realistic distribution
function pickSeverity() {
  const r = Math.random();
  if (r < 0.08)  return 'high';    // 8%  → CRITICAL
  if (r < 0.20)  return 'medium';  // 12% → MAJOR
  if (r < 0.35)  return 'low';     // 15% → MINOR
  if (r < 0.60)  return 'warning'; // 25% → WARNING
  return 'info';                    // 40% → INFO
}

// sourceB uses priority numbers: 1=CRITICAL, 2=MAJOR, 3=MINOR, 4=WARNING, 5=INFO
function pickPriority() {
  const r = Math.random();
  if (r < 0.08) return 1; // CRITICAL
  if (r < 0.20) return 2; // MAJOR
  if (r < 0.35) return 3; // MINOR
  if (r < 0.60) return 4; // WARNING
  return 5;                // INFO
}

// sourceA messages by severity
const MESSAGES_BY_LEVEL = {
  high:    ['Link interface down', 'BGP session hard reset', 'Power supply failure', 'Hardware fault detected'],
  medium:  ['CPU above 90%', 'Memory pressure at 85%', 'OSPF neighbor down', 'Route flap detected'],
  low:     ['Interface flapping', 'NTP drift above threshold', 'Packet loss 5% on uplink'],
  warning: ['Latency spike on WAN', 'SFP temperature elevated', 'Buffer drops increasing'],
  info:    ['Config backup completed', 'Scheduled maintenance window', 'SNMP trap received', 'Interface UP'],
};

// sourceB descriptions
const SOURCE_B_DESCRIPTIONS = [
  'Power supply unit failure detected',
  'Optical signal degraded below threshold',
  'Fan module failure – thermal risk',
  'SFP module not recognized',
  'VLAN mismatch causing loop',
  'NTP synchronization failure',
  'Spanning tree topology change',
  'Routing table size exceeded warning threshold',
  'RADIUS authentication server unreachable',
  'Scheduled configuration backup completed',
  'Interface utilization above 80%',
  'BGP peer flapping',
];

/**
 * Generate mock alarms from Source A
 * Format: { alarmId, site, device, level, msg, time }
 */
function generateSourceAAlarms(count = 5) {
  const alarms = [];
  for (let i = 0; i < count; i++) {
    const site   = SITES[Math.floor(Math.random() * SITES.length)];
    const device = DEVICES[Math.floor(Math.random() * DEVICES.length)];
    const level  = pickSeverity();
    const msgs   = MESSAGES_BY_LEVEL[level] || MESSAGES_BY_LEVEL.info;
    const msg    = msgs[Math.floor(Math.random() * msgs.length)];

    alarms.push({
      alarmId: `A-${uuidv4().slice(0, 8)}`,
      site:    site.siteId,
      device,
      level,
      msg,
      time:    new Date().toISOString(),
    });
  }
  return alarms;
}

/**
 * Generate mock alarms from Source B
 * Format: { id, location, equipment, priority, description, timestamp }
 */
function generateSourceBAlarms(count = 5) {
  const alarms = [];
  for (let i = 0; i < count; i++) {
    const site        = SITES[Math.floor(Math.random() * SITES.length)];
    const device      = DEVICES[Math.floor(Math.random() * DEVICES.length)];
    const priority    = pickPriority();
    const description = SOURCE_B_DESCRIPTIONS[Math.floor(Math.random() * SOURCE_B_DESCRIPTIONS.length)];

    alarms.push({
      id:          `B-${uuidv4().slice(0, 8)}`,
      location:    site.siteId,
      equipment:   device,
      priority,
      description,
      timestamp:   Date.now(),
    });
  }
  return alarms;
}

module.exports = { generateSourceAAlarms, generateSourceBAlarms };
