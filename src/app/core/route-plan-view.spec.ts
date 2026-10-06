import { DeliveryRouteModel, RoutePlanModel } from './route-plan.models';
import { approximateLine, deadlineLabel, geometryToLatLngs, routeColor, routingSourceLabel, stopLine } from './route-plan-view';

const ROAD_JOB: DeliveryRouteModel = {
  riderIndex: 1,
  riderId: 2,
  totalOrders: 2,
  totalBoxes: 3,
  distanceKm: 4.3,
  durationMinutes: 18,
  estimatedStartTime: '11:30',
  estimatedFinishTime: '11:48',
  deliveryCost: 32.2,
  geometry: { type: 'LineString', coordinates: [[103.25, 16.24], [103.26, 16.25]] },
  approximate: false,
  stops: [
    { sequence: 1, orderId: 7, customerId: 3, customerName: 'C', phone: '0803', address: null, latitude: 16.25, longitude: 103.26, boxCount: 3, distanceFromPreviousKm: 4.3, travelTimeFromPreviousMin: 18, estimatedArrivalTime: '11:48', deliveryStatus: 'WAITING' },
  ],
};

const PLAN: RoutePlanModel = {
  routePlanId: 1,
  planDate: '2026-09-20',
  status: 'GENERATED',
  routingSource: 'ROAD',
  approximate: false,
  riderCount: 1,
  totalDistanceKm: 4.3,
  estimatedFinishTime: '11:48',
  totalBoxes: 3,
  totalRevenue: 195,
  totalFoodCost: 120,
  totalDeliveryCost: 32.2,
  estimatedProfit: 42.8,
  jobs: [ROAD_JOB],
};

describe('route-plan-view', () => {
  it('maps the API plan to the view without recomputing backend values', () => {
    expect(PLAN.totalRevenue).toBe(195);
    expect(PLAN.jobs[0]!.deliveryCost).toBe(32.2);
    expect(PLAN.jobs[0]!.estimatedFinishTime).toBe('11:48');
  });

  it('assigns distinct palette colors per rider index', () => {
    expect(routeColor(0)).not.toBe(routeColor(1));
    expect(routeColor(0)).toBeTruthy();
  });

  it('converts GeoJSON [lng, lat] to Leaflet [lat, lng]', () => {
    expect(geometryToLatLngs(ROAD_JOB)).toEqual([[16.24, 103.25], [16.25, 103.26]]);
  });

  it('returns null geometry mapping when the backend fell back', () => {
    expect(geometryToLatLngs({ ...ROAD_JOB, geometry: null })).toBeNull();
    expect(approximateLine([16.24, 103.25], { ...ROAD_JOB, geometry: null })[0]).toEqual([16.24, 103.25]);
  });

  it('labels road vs approximate routing for the fallback state', () => {
    expect(routingSourceLabel(PLAN)).toContain('OSRM');
    expect(routingSourceLabel({ ...PLAN, routingSource: 'HAVERSINE', approximate: true })).toContain('โดยประมาณ');
    expect(routingSourceLabel({ ...PLAN, jobs: [{ ...ROAD_JOB, geometry: null }] })).toContain('เส้นบนแผนที่เป็นเส้นประมาณ');
    expect(routingSourceLabel({ ...PLAN, jobs: [ROAD_JOB, { ...ROAD_JOB, geometry: null }] })).toContain('บางเส้น');
  });

  it('uses the order leg and labels older plans without leg geometry approximate', () => {
    const job = { ...ROAD_JOB, stops: [
      { ...ROAD_JOB.stops[0]!, geometry: { type: 'LineString' as const, coordinates: [[103.25, 16.24], [103.26, 16.25]] as Array<[number, number]> } },
      { ...ROAD_JOB.stops[0]!, orderId: 8, latitude: 16.26, longitude: 103.27, geometry: null },
    ] };
    expect(stopLine([16.24, 103.25], job, 0)).toEqual({ points: [[16.24, 103.25], [16.25, 103.26]], approximate: false });
    expect(stopLine([16.24, 103.25], job, 1)).toEqual({ points: [[16.25, 103.26], [16.26, 103.27]], approximate: true });
  });

  it('reports deadline status factually from backend finish time', () => {
    expect(deadlineLabel(PLAN, '12:30')).toBe('ส่งทันภายในกำหนด');
    expect(deadlineLabel({ ...PLAN, estimatedFinishTime: '12:31' }, '12:30')).toBe('เกินกำหนด');
  });
});
