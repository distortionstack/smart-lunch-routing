import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ApiOrderStatus = 'PENDING' | 'PLANNED' | 'DELIVERING' | 'DELIVERED' | 'CANCELLED';
export interface ApiOrder {
  id: number;
  customerId: number;
  boxes: number;
  status: ApiOrderStatus;
  orderDate: string;
  isSimulated: boolean;
  distanceKm?: number;
}
export type ApiOrderInput = Pick<ApiOrder, 'customerId' | 'boxes'> & { status?: ApiOrderStatus; orderDate?: string };

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/orders`;

  list(date?: string): Observable<ApiOrder[]> {
    return this.http.get<ApiOrder[]>(this.url, { params: date ? { date } : {} });
  }
  nearby(date?: string, status?: ApiOrderStatus, radiusKm=2): Observable<ApiOrder[]> {
    return this.http.get<ApiOrder[]>(`${this.url}/nearby`, {params:{radiusKm,...(date ? {date} : {}),...(status ? {status} : {})}});
  }
  create(input: ApiOrderInput): Observable<ApiOrder> { return this.http.post<ApiOrder>(this.url, input); }
  update(id: number, input: ApiOrderInput): Observable<ApiOrder> { return this.http.put<ApiOrder>(`${this.url}/${id}`, input); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.url}/${id}`); }
  simulate(date: string, count = 25): Observable<{ createdCount: number; orders: ApiOrder[] }> {
    return this.http.post<{ createdCount: number; orders: ApiOrder[] }>(`${this.url}/simulate`, { count, orderDate: date });
  }
  clearSimulated(orderIds: number[]): Observable<{ deletedCount: number }> {
    return this.http.delete<{ deletedCount: number }>(`${this.url}/simulated`, { body: { orderIds } });
  }
}
