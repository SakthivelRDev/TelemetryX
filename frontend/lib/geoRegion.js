/**
 * Geo-region detection utility for App360.
 *
 * Uses the browser Geolocation API (no external service) to get the user's
 * lat/lng, then maps it to one of the India network regions:
 *   North · South · East · West
 *
 * Bounding boxes are approximate and cover major telecom zones in India.
 */

// Ordered list — first match wins
const REGION_BOUNDS = [
  {
    region: 'North',
    // Northern India: J&K, HP, Punjab, Haryana, UP, Uttarakhand, Delhi
    minLat: 26.5, maxLat: 37.0,
    minLng: 68.0, maxLng: 82.0,
  },
  {
    region: 'East',
    // Eastern India: West Bengal, Odisha, Bihar, Jharkhand, NE states
    minLat: 19.0, maxLat: 28.5,
    minLng: 82.0, maxLng: 97.5,
  },
  {
    region: 'West',
    // Western India: Gujarat, Maharashtra, Rajasthan, Goa
    minLat: 15.0, maxLat: 30.0,
    minLng: 68.0, maxLng: 76.5,
  },
  {
    region: 'South',
    // Southern India: Karnataka, Tamil Nadu, Kerala, AP, Telangana
    minLat: 8.0,  maxLat: 20.0,
    minLng: 74.0, maxLng: 84.5,
  },
];

/**
 * Resolve a lat/lng to a region name.
 * Returns the matched region string or null if outside all bounds.
 */
function latLngToRegion(lat, lng) {
  for (const b of REGION_BOUNDS) {
    if (lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng) {
      return b.region;
    }
  }
  // Fallback: closest centroid (handles edge-of-India cases)
  const centroids = [
    { region: 'North', lat: 29.5, lng: 77.0 },
    { region: 'South', lat: 13.0, lng: 79.0 },
    { region: 'East',  lat: 23.0, lng: 87.0 },
    { region: 'West',  lat: 22.0, lng: 72.5 },
  ];
  let nearest = null;
  let minDist  = Infinity;
  for (const c of centroids) {
    const dist = Math.hypot(lat - c.lat, lng - c.lng);
    if (dist < minDist) { minDist = dist; nearest = c.region; }
  }
  return nearest;
}

/**
 * Requests the browser's current position and resolves it to an India region.
 *
 * @returns {Promise<{ region: string, lat: number, lng: number } | null>}
 *   Resolves to the region data, or null if geolocation is denied / unavailable.
 */
export function detectUserRegion() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        const region = latLngToRegion(lat, lng);
        resolve(region ? { region, lat, lng } : null);
      },
      () => {
        // User denied or error — resolve null so the map falls back to showing all
        resolve(null);
      },
      { timeout: 6000, maximumAge: 300_000 }  // cache position for 5 min
    );
  });
}
