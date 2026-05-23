/**
 * Mock Alarm Generator
 * Simulates two external REST API sources with different raw data formats.
 * sourceA: SNMP-trap-style format
 * sourceB: REST-API-style format
 */

const { v4: uuidv4 } = require('uuid');

// Indian site names matching DB seed
const SITES = [
  { siteId: 'mumbai-noc',     siteName: 'Mumbai NOC'     },
  { siteId: 'delhi-hub',      siteName: 'Delhi Hub'       },
  { siteId: 'bangalore-core', siteName: 'Bangalore Core'  },
  { siteId: 'chennai-edge',   siteName: 'Chennai Edge'    },
  { siteId: 'kolkata-ring',   siteName: 'Kolkata Ring'    },
  { siteId: 'hyderabad-dc',   siteName: 'Hyderabad DC'    },
  { siteId: 'pune-relay',     siteName: 'Pune Relay'      },
];

const DEVICES = ['RTR-01', 'RTR-02', 'SW-01', 'SW-02', 'FW-01', 'LNK-01'];

// sourceA levels and messages
const SOURCE_A_LEVELS = ['high', 'medium', 'low', 'info'];
const SOURCE_A_MESSAGES = [
  'Link interface down',
  'BGP peer session reset',
  'CPU utilization spike above 90%',
  'Memory usage critical threshold',
  'Packet loss detected on uplink',
  'Interface flapping repeatedly',
  'OSPF neighbor down',
];

// sourceB priorities and descriptions
const SOURCE_B_PRIORITIES = [1, 2, 3, 4];
const SOURCE_B_DESCRIPTIONS = [
  'Power supply unit failure detected',
  'Optical signal degraded below threshold',
  'Fan module failure – thermal risk',
  'SFP module not recognized',
  'VLAN mismatch causing loop',
  'NTP synchronization failure',
  'Spanning tree topology change',
];

/**
 * Generate mock alarms from Source A
 * Format: { alarmId, site, device, level, msg, time }
 */
function generateSourceAAlarms(count = 5) {
  const alarms = [];
  for (let i = 0; i < count; i++) {
    const site = SITES[Math.floor(Math.random() * SITES.length)];
    const device = DEVICES[Math.floor(Math.random() * DEVICES.length)];
    const level = SOURCE_A_LEVELS[Math.floor(Math.random() * SOURCE_A_LEVELS.length)];
    const msg = SOURCE_A_MESSAGES[Math.floor(Math.random() * SOURCE_A_MESSAGES.length)];

    alarms.push({
      alarmId: `A-${uuidv4().slice(0, 8)}`,
      site: site.siteId,
      device,
      level,
      msg,
      time: new Date().toISOString(),
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
    const site = SITES[Math.floor(Math.random() * SITES.length)];
    const device = DEVICES[Math.floor(Math.random() * DEVICES.length)];
    const priority = SOURCE_B_PRIORITIES[Math.floor(Math.random() * SOURCE_B_PRIORITIES.length)];
    const description = SOURCE_B_DESCRIPTIONS[Math.floor(Math.random() * SOURCE_B_DESCRIPTIONS.length)];

    alarms.push({
      id: `B-${uuidv4().slice(0, 8)}`,
      location: site.siteId,
      equipment: device,
      priority,
      description,
      timestamp: Date.now(),
    });
  }
  return alarms;
}

module.exports = { generateSourceAAlarms, generateSourceBAlarms };
