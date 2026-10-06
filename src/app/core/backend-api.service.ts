import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Customer, Order, OrderStatus, Rider } from './models';

/** รูปทรงข้อมูลดิบจาก backend (ดู backend src/models/) */
export interface BackendCustomer {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  lat: number;
  lng: number;
}
export type BackendOrderStatus = 'PENDING' | 'PLANNED' | 'DELIVERING' | 'DELIVERED' | 'CANCELLED';
export interface BackendOrder {
  id: number;
  customerId: number;
  boxes: number;
  status: BackendOrderStatus;
  orderDate: string;
  createdAt?: string;
}
export interface BackendRider {
  workStatus?: Rider['workStatus'];
  assignedOrdersToday?: number;
  id: number;
  name: string;
  phone: string | null;
  isAvailable: boolean;
}

const RIDER_COLORS = [
  '#d13b45', '#16865c', '#0053fd', '#c96a16', '#7549c7',
  '#0b7a88', '#4e7472', '#a25228', '#5967a2', '#7b5e39',
];

export function fromBackendStatus(status: BackendOrderStatus): OrderStatus {
  if (status === 'PENDING') return 'pending';
  if (status === 'DELIVERED') return 'delivered';
  return 'assigned';
}

export function toBackendStatus(status: OrderStatus): BackendOrderStatus {
  if (status === 'pending') return 'PENDING';
  if (status === 'delivered') return 'DELIVERED';
  return 'PLANNED';
}

export function todayLocal(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function mapCustomer(raw: BackendCustomer): Customer {
  return {
    id: String(raw.id),
    name: raw.name,
    phone: raw.phone,
    address: raw.address ?? '',
    lat: Number(raw.lat),
    lng: Number(raw.lng),
  };
}

export function mapOrder(raw: BackendOrder): Order {
  return {
    id: String(raw.id),
    customerId: String(raw.customerId),
    boxes: raw.boxes,
    status: fromBackendStatus(raw.status),
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

export function mapRider(raw: BackendRider, index: number): Rider {
  return {
    workStatus: raw.workStatus,
    assignedOrdersToday: raw.assignedOrdersToday,
    id: String(raw.id),
    name: raw.name,
    phone: raw.phone ?? '',
    jobCode: `LUNCH-${raw.id}`,
    color: RIDER_COLORS[index % RIDER_COLORS.length]!,
  };
}

/**
 * Client คุย backend ตรง ๆ — ทุก method คืนโมเดลฝั่ง frontend ที่ map แล้ว
 * หน้าเว็บเรียกผ่าน DeliveryService จึงไม่ต้องรู้เรื่อง HTTP หรือ id ที่เป็นตัวเลข
 */
@Injectable({ providedIn: 'root' })
export class BackendApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  listCustomers(): Observable<Customer[]> {
    return this.http
      .get<BackendCustomer[]>(`${this.base}/customers`)
      .pipe(map((rows) => rows.map(mapCustomer)));
  }

  createCustomer(input: { name: string; phone: string; address: string; lat: number; lng: number }): Observable<Customer> {
    return this.http
      .post<BackendCustomer>(`${this.base}/customers`, { ...input, address: input.address || null })
      .pipe(map(mapCustomer));
  }

  updateCustomer(id: string | number, input: { name: string; phone: string; address: string; lat: number; lng: number }): Observable<Customer> {
    return this.http
      .put<BackendCustomer>(`${this.base}/customers/${id}`, { ...input, address: input.address || null })
      .pipe(map(mapCustomer));
  }

  deleteCustomer(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.base}/customers/${id}`);
  }

  listOrders(): Observable<Order[]> {
    return this.http
      .get<BackendOrder[]>(`${this.base}/orders`, { params: { date: todayLocal() } })
      .pipe(map((rows) => rows.map(mapOrder)));
  }

  createOrder(input: { customerId: string | number; boxes: number; orderDate?: string }): Observable<Order> {
    return this.http
      .post<BackendOrder>(`${this.base}/orders`, {
        customerId: Number(input.customerId),
        boxes: input.boxes,
        status: 'PENDING',
        orderDate: input.orderDate ?? todayLocal(),
      })
      .pipe(map(mapOrder));
  }

  updateOrder(
    id: string | number,
    input: { customerId: string | number; boxes: number; status: OrderStatus },
  ): Observable<Order> {
    return this.http
      .put<BackendOrder>(`${this.base}/orders/${id}`, {
        customerId: Number(input.customerId),
        boxes: input.boxes,
        status: toBackendStatus(input.status),
      })
      .pipe(map(mapOrder));
  }

  deleteOrder(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.base}/orders/${id}`);
  }

  listRiders(): Observable<Rider[]> {
    return this.http
      .get<BackendRider[]>(`${this.base}/riders`)
      .pipe(map((rows) => rows.map((row, index) => mapRider(row, index))));
  }
}
