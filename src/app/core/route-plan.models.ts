/**
 * Backend RoutePlan response contract (mirrors
 * backend/src/domain/routing/route-plan.types.ts).
 *
 * The frontend renders these values as-is — routing, costing, and timing
 * are decided by the backend and never recomputed here.
 */
export interface RouteStopModel {
  sequence: number;
  orderId: number;
  customerId: number;
  customerName: string;
  phone: string;
  address: string | null;
  latitude: number;
  longitude: number;
  boxCount: number;
  distanceFromPreviousKm: number;
  travelTimeFromPreviousMin: number;
  estimatedArrivalTime: string;
  deliveryStatus: 'WAITING' | 'DELIVERING' | 'DELIVERED';
  geometry?: GeoJsonLineString | null;
}

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: Array<[number, number]>;
}

export interface DeliveryRouteModel {
  acknowledgedAt?: string | null;
  status?: 'WAITING'|'DELIVERING'|'COMPLETED'|'CANCELLED';
  jobId?: number;
  jobCode?: string;
  riderIndex: number;
  riderId: number | null;
  totalOrders: number;
  totalBoxes: number;
  distanceKm: number;
  durationMinutes: number;
  estimatedStartTime: string;
  estimatedFinishTime: string;
  deliveryCost: number;
  geometry: GeoJsonLineString | null;
  approximate: boolean;
  stops: RouteStopModel[];
}

export type RoutePlanStatus = 'GENERATED' | 'SELECTED' | 'REJECTED';

export interface RoutePlanModel {
  startTime?: string;
  deliveryDeadline?: string;
  shop?: import('./shop-settings-api.service').ShopSettings;
  routePlanId?: number;
  planDate: string;
  status: RoutePlanStatus;
  routingSource: 'ROAD' | 'HAVERSINE';
  approximate: boolean;
  fallbackReason?: string;
  riderCount: number;
  totalDistanceKm: number;
  estimatedFinishTime: string;
  totalBoxes: number;
  totalRevenue: number;
  totalFoodCost: number;
  totalDeliveryCost: number;
  estimatedProfit: number;
  jobs: DeliveryRouteModel[];
}

/** List/summary contract: same metrics, no `jobs` (see detail endpoint). */
export type RoutePlanSummaryModel = Omit<RoutePlanModel, 'jobs'>;
