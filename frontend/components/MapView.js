'use client';
/**
 * Thin client-only entry for dynamic import from map page.
 * Keeps Leaflet out of the main bundle and avoids chunk path issues.
 */
import SiteMap from './SiteMap';
export default SiteMap;
