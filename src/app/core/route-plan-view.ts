import { DeliveryRouteModel, RoutePlanModel } from './route-plan.models';

/**
 * Pure view-model mapping for the route-planning page (tested, no Angular
 * dependencies): distinct route colors, GeoJSON `[lng, lat]` → Leaflet
 * `[lat, lng]` conversion, and human-readable routing-source labels.
 * All numbers/times come straight from the backend response.
 */

/** Predefined presentation palette — one distinct color per rider route. */
export const ROUTE_PALETTE = [
  '#9f2f2d',
  '#346538',
  '#1f6c9f',
  '#956400',
  '#6d4aa0',
  '#b3541e',
  '#0e7c7b',
  '#a02060',
  '#4a6b1f',
  '#31437c',
] as const;

export function routeColor(riderIndex: number): string {
  return ROUTE_PALETTE[riderIndex % ROUTE_PALETTE.length]!;
}

export type LatLng = [number, number];

/**
 * Convert a backend GeoJSON LineString (`[longitude, latitude]`) to a
 * Leaflet polyline (`[latitude, longitude]`). Returns null when the plan
 * used fallback routing and carries no road geometry.
 */
export function geometryToLatLngs(job: DeliveryRouteModel): LatLng[] | null {
  if (!job.geometry) return null;
  return job.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

/** Approximate fallback line shop → stops (dashed display when geometry is null). */
export function approximateLine(
  shop: LatLng,
  job: DeliveryRouteModel,
): LatLng[] {
  return [shop, ...job.stops.map((stop): LatLng => [stop.latitude, stop.longitude])];
}

export function routingSourceLabel(plan: RoutePlanModel): string {
  const roadLines = plan.jobs.filter((job) => job.geometry != null).length;
  if (plan.routingSource === 'ROAD' && !plan.approximate) {
    if (roadLines > 0 && roadLines === plan.jobs.length) return 'ระยะทางและเส้นถนนจริง (OSRM)';
    return roadLines ? 'ระยะทาง OSRM · บางเส้นบนแผนที่เป็นเส้นประมาณ'
      : 'ระยะทาง OSRM · เส้นบนแผนที่เป็นเส้นประมาณ';
  }
  return roadLines ? 'ระยะทางโดยประมาณ · เส้นบนแผนที่บางส่วนมาจาก OSRM'
    : 'ระยะทางและเส้นทางโดยประมาณ (สำรอง)';
}

/** A single order's leg starts at the shop or the previous delivery stop. */
export function stopLine(shop: LatLng, job: DeliveryRouteModel, index: number): { points: LatLng[]; approximate: boolean } {
  const stop = job.stops[index];
  if (!stop) return { points: [], approximate: true };
  const coordinates = stop.geometry?.coordinates;
  if (coordinates && coordinates.length >= 2) {
    return { points: coordinates.map(([lng, lat]) => [lat, lng]), approximate: false };
  }
  const previous = job.stops[index - 1];
  return {
    points: [previous ? [previous.latitude, previous.longitude] : shop, [stop.latitude, stop.longitude]],
    approximate: true,
  };
}

export function deadlineLabel(plan: RoutePlanModel, deadline: string): string {
  return plan.estimatedFinishTime <= deadline ? 'ส่งทันภายในกำหนด' : 'เกินกำหนด';
}
