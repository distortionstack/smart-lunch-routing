export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
}

export type OrderStatus = 'pending' | 'assigned' | 'delivered';

export interface Order {
  id: string;
  customerId: string;
  boxes: number;
  status: OrderStatus;
  createdAt: string;
}

export interface Rider {
  workStatus?: 'READY'|'BUSY'|'DELIVERING'|'PAUSED'|'UNCONFIGURED';
  assignedOrdersToday?: number;
  id: string;
  name: string;
  phone: string;
  jobCode: string;
  color: string;
}

export interface RouteStop {
  order: Order;
  customer: Customer;
  sequence: number;
  distanceFromPreviousKm: number;
  arrivalTime: string;
  deliveryStatus?: 'WAITING' | 'DELIVERING' | 'DELIVERED';
}

export interface RiderRoute {
  estimatedStartTime?: string;
  estimatedFinishTime?: string;
  rider: Rider;
  stops: RouteStop[];
  totalBoxes: number;
  distanceKm: number;
  durationMinutes: number;
  deliveryCost: number;
  revenue: number;
  foodCost: number;
  profit: number;
  deadlineSafe: boolean;
}

export interface RoutePlan {
  startTime?: string;
  deliveryDeadline?: string;
  shop?: import('./shop-settings-api.service').ShopSettings;
  estimatedFinishTime?: string;
  version: number;
  generatedAt: string;
  routes: RiderRoute[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  deliveryCost: number;
  revenue: number;
  foodCost: number;
  profit: number;
  deadlineSafe: boolean;
}

export const SHOP = {
  name: 'ครัวเที่ยงตรง',
  lat: 16.24631,
  lng: 103.25286,
  departureTime: '11:30',
  deadlineTime: '12:30',
} as const;
