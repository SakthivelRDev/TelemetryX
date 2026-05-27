/**
 * Telecom topology: RAN (radio) → CORE (5G/EPC) → TRANSPORT (backhaul).
 * Links are built globally so every site connects into the stack.
 */

function distKm(a, b) {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function nearest(from, candidates, preferRegion = true) {
  const pool = preferRegion
    ? candidates.filter((c) => c.region === from.region)
    : [];
  const list = pool.length ? pool : candidates;
  if (!list.length) return null;
  return list.reduce((best, c) => (distKm(from, c) < distKm(from, best) ? c : best));
}

function linkKey(a, b) {
  return [a.id, b.id].sort().join('|');
}

/**
 * @returns {Array<{ from, to, kind, color, weight, opacity, dashArray }>}
 */
export function buildTopologyLinks(sites) {
  const valid = sites.filter((s) => s.lat != null && s.lng != null);
  const rans       = valid.filter((s) => s.networkLayer === 'RAN');
  const cores      = valid.filter((s) => s.networkLayer === 'CORE');
  const transports = valid.filter((s) => s.networkLayer === 'TRANSPORT');

  const links = [];
  const seen  = new Set();

  const add = (from, to, opts) => {
    if (!from || !to || from.id === to.id) return;
    const k = linkKey(from, to);
    if (seen.has(k)) return;
    seen.add(k);
    links.push({ from, to, ...opts });
  };

  // 1) RAN → CORE (fronthaul / midhaul)
  rans.forEach((ran) => {
    const core = nearest(ran, cores, true) || nearest(ran, cores, false);
    if (core) {
      add(ran, core, {
        kind: 'RAN_CORE',
        color: '#22d3ee',
        weight: 2,
        opacity: 0.7,
        dashArray: '6 4',
      });
    }
  });

  // 2) CORE → TRANSPORT (backhaul egress)
  cores.forEach((core) => {
    const transport = nearest(core, transports, true) || nearest(core, transports, false);
    if (transport) {
      add(core, transport, {
        kind: 'CORE_TRANSPORT',
        color: '#f59e0b',
        weight: 2.5,
        opacity: 0.75,
        dashArray: '2 6',
      });
    }
  });

  // 3) Orphan TRANSPORT → nearest CORE (regions with only transport, e.g. East)
  transports.forEach((t) => {
    const hasCoreLink = links.some(
      (l) => (l.from.id === t.id || l.to.id === t.id) && (l.kind === 'CORE_TRANSPORT')
    );
    if (!hasCoreLink && cores.length) {
      const core = nearest(t, cores, false);
      if (core) {
        add(t, core, {
          kind: 'TRANSPORT_CORE',
          color: '#a855f7',
          weight: 2,
          opacity: 0.5,
          dashArray: '4 6',
        });
      }
    }
  });

  // 4) CORE ↔ CORE national backbone (sorted by longitude)
  if (cores.length >= 2) {
    const sorted = [...cores].sort((a, b) => a.lng - b.lng);
    for (let i = 0; i < sorted.length - 1; i++) {
      add(sorted[i], sorted[i + 1], {
        kind: 'CORE_BACKBONE',
        color: '#a855f7',
        weight: 2,
        opacity: 0.35,
        dashArray: '2 10',
      });
    }
  }

  // 5) TRANSPORT ring (national backhaul mesh)
  if (transports.length >= 2) {
    const sorted = [...transports].sort((a, b) => a.lng - b.lng);
    for (let i = 0; i < sorted.length - 1; i++) {
      add(sorted[i], sorted[i + 1], {
        kind: 'TRANSPORT_MESH',
        color: '#64748b',
        weight: 1.5,
        opacity: 0.45,
        dashArray: '8 4',
      });
    }
    add(sorted[sorted.length - 1], sorted[0], {
      kind: 'TRANSPORT_MESH',
      color: '#64748b',
      weight: 1.5,
      opacity: 0.45,
      dashArray: '8 4',
    });
  }

  return links;
}
