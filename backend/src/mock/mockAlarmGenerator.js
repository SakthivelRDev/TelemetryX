/**
 * Mock Alarm Generator – Telecom AIOps
 *
 * Generates realistic mock alarms with:
 * - 3-level severity: CRITICAL (10%) | MEDIUM (45%) | LOW (45%)
 * - RAN / CORE / TRANSPORT network layer awareness
 * - Layer-specific device IDs and alarm messages
 *
 * This simulates real-world alarm feeds from:
 *   sourceA → EMS/NMS format  { alarmId, site, device, level, msg, time }
 *   sourceB → OSS REST format  { id, location, equipment, priority, description, timestamp }
 */

// ── Severity Weights ──────────────────────────────────────────────────────
const SEVERITY_WEIGHTS = [
  { value: 'CRITICAL', weight: 10 },
  { value: 'MEDIUM',   weight: 45 },
  { value: 'LOW',      weight: 45 },
];

function pickWeighted(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

// ── Site Catalogue (slug → network layer) ─────────────────────────────────
const SITE_LAYER_MAP = {
  'mumbai-core-dc':     'CORE',
  'bangalore-core-dc':  'CORE',
  'hyderabad-core-dc':  'CORE',
  'delhi-core-hub':     'CORE',
  'chennai-transport':  'TRANSPORT',
  'kolkata-ring-node':  'TRANSPORT',
  'pune-backhaul-hub':  'TRANSPORT',
  'ahmedabad-transit':  'TRANSPORT',
  'mumbai-ran-north':   'RAN',
  'mumbai-ran-south':   'RAN',
  'delhi-ran-central':  'RAN',
  'bangalore-ran-east': 'RAN',
  'chennai-ran-grid':   'RAN',
};

// ── Layer-Specific Device IDs ──────────────────────────────────────────────
const LAYER_DEVICES = {
  RAN: [
    'gNodeB-MH-01', 'gNodeB-MH-02', 'eNodeB-MH-01',
    'CU-MH-01', 'DU-MH-01', 'RRU-MH-01', 'Antenna-MH-01',
    'gNodeB-DL-01', 'eNodeB-DL-02', 'CU-DL-01',
  ],
  CORE: [
    'AMF-01', 'AMF-02', 'SMF-01', 'SMF-02',
    'UPF-01', 'UPF-02', 'MME-01', 'SGW-01',
    'PCF-01', 'HSS-01', 'NRF-01',
  ],
  TRANSPORT: [
    'RTR-AGG-01', 'RTR-AGG-02', 'RTR-CORE-01',
    'SW-DIST-01', 'SW-DIST-02', 'OTN-01',
    'MW-Link-01', 'FW-01', 'FW-02',
  ],
};

// ── Layer-Specific Source A Messages ──────────────────────────────────────
const LAYER_MSGS_A = {
  RAN: [
    'Cell outage – RF signal loss',
    'Handover failure – UE dropped',
    'RACH congestion – uplink overloaded',
    'gNodeB X2 interface down',
    'CU-DU F1 link failure',
    'Radio link failure – beam blocked',
    'Antenna sector mis-aligned',
    'Interference detected – adjacent cell',
    'DU processing overload',
    'UE capacity threshold breached',
  ],
  CORE: [
    'AMF registration rejected – UE unreachable',
    'SMF session not established',
    'UPF N4 session failure',
    'MME authentication timeout – HLR unavailable',
    'HSS subscriber data unavailable',
    'PCF policy push failure',
    'SGW-PGW S5/S8 tunnel loss',
    'Core node CPU overload – session drops',
    'NRF NF discovery failure',
    'Subscriber overload – PDU drop',
  ],
  TRANSPORT: [
    'Backhaul link down – possible fiber cut',
    'BGP peer session reset',
    'Packet loss exceeds 8% threshold',
    'OTN transponder failure',
    'Microwave link degraded – rain fade',
    'MPLS LSP rerouted – traffic affected',
    'Switch port flapping detected',
    'Firewall policy mismatch – traffic blocked',
    'RTR interface CRC error spike',
    'Latency spike > 150ms on backhaul',
  ],
};

// ── Source A Level → internal level (for normalization) ───────────────────
const SOURCE_A_LEVELS = {
  RAN:       ['high', 'medium', 'low'],
  CORE:      ['high', 'medium', 'low'],
  TRANSPORT: ['high', 'medium', 'low'],
};

// ── Source B Priority → number ─────────────────────────────────────────────
// 1 = CRITICAL, 2 = MEDIUM, 3 = LOW

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function siteSlug(siteName) {
  return siteName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function getLayerForSite(slug) {
  return SITE_LAYER_MAP[slug] || 'TRANSPORT';
}

function pickDevice(layer) {
  const devices = LAYER_DEVICES[layer] || LAYER_DEVICES.TRANSPORT;
  return devices[Math.floor(Math.random() * devices.length)];
}

function pickMessage(layer) {
  const msgs = LAYER_MSGS_A[layer] || LAYER_MSGS_A.TRANSPORT;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function severityToSourceALevel(sev) {
  if (sev === 'CRITICAL') return 'high';
  if (sev === 'MEDIUM')   return 'medium';
  return 'low';
}

function severityToSourceBPriority(sev) {
  if (sev === 'CRITICAL') return 1;
  if (sev === 'MEDIUM')   return 2;
  return 3;
}

const INDIA_SITES = [
  'mumbai-core-dc', 'bangalore-core-dc', 'hyderabad-core-dc', 'delhi-core-hub',
  'chennai-transport', 'kolkata-ring-node', 'pune-backhaul-hub', 'ahmedabad-transit',
  'mumbai-ran-north', 'mumbai-ran-south', 'delhi-ran-central', 'bangalore-ran-east', 'chennai-ran-grid',
];

/**
 * Generate Source A format alarms (EMS/NMS trap style)
 * Format: { alarmId, site, device, level, msg, time }
 */
function generateSourceA(count = 5) {
  const alarms = [];
  for (let i = 0; i < count; i++) {
    const slug   = INDIA_SITES[Math.floor(Math.random() * INDIA_SITES.length)];
    const layer  = getLayerForSite(slug);
    const sev    = pickWeighted(SEVERITY_WEIGHTS);
    alarms.push({
      alarmId: `SRC-A-${Date.now()}-${i}`,
      site:    slug,
      device:  pickDevice(layer),
      level:   severityToSourceALevel(sev),
      msg:     pickMessage(layer),
      time:    new Date().toISOString(),
    });
  }
  return alarms;
}

/**
 * Generate Source B format alarms (OSS REST poller style)
 * Format: { id, location, equipment, priority, description, timestamp }
 */
function generateSourceB(count = 5) {
  const alarms = [];
  for (let i = 0; i < count; i++) {
    const slug   = INDIA_SITES[Math.floor(Math.random() * INDIA_SITES.length)];
    const layer  = getLayerForSite(slug);
    const sev    = pickWeighted(SEVERITY_WEIGHTS);
    alarms.push({
      id:          `SRC-B-${Date.now()}-${i}`,
      location:    slug,
      equipment:   pickDevice(layer),
      priority:    severityToSourceBPriority(sev),
      description: pickMessage(layer),
      timestamp:   Date.now(),
    });
  }
  return alarms;
}

module.exports = { generateSourceA, generateSourceB };
