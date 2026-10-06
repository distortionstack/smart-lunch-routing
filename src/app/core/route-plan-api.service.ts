import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { RoutePlanModel, RoutePlanSummaryModel } from './route-plan.models';
import { DeliveryRouteModel } from './route-plan.models';
import { AuthService } from './auth.service';

/**
 * Backend RoutePlan API client. Thin HTTP wrapper — response values are
 * passed through to the view untouched (backend remains source of truth).
 *
 * The base path comes from `environment.apiBaseUrl` (`/api` in development
 * behind the dev proxy, the deployed API origin in production). No environment
 * URL is ever hard-coded here.
 */
@Injectable({ providedIn: 'root' })
export class RoutePlanApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService, { optional: true });
  private cacheGeneration = 0;

  private currentResponse(): () => boolean {
    const generation = this.cacheGeneration;
    const token = this.auth?.token();
    return () => generation === this.cacheGeneration && token === this.auth?.token();
  }
  private readonly baseUrl = `${environment.apiBaseUrl}/route-plans`;
  private readonly cacheKey = `smart-lunch-route-details-v1:${this.baseUrl}`;
  private readonly cacheAgeMs = 30_000;

  private readCache(): Record<string, { savedAt: number; plan: RoutePlanModel }> {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(this.cacheKey) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, { savedAt: number; plan: RoutePlanModel }> : {};
    }
    catch { return {}; }
  }

  private writeCache(rows: Record<string, { savedAt: number; plan: RoutePlanModel }>): void {
    try { localStorage.setItem(this.cacheKey, JSON.stringify(rows)); }
    catch { try { localStorage.removeItem(this.cacheKey); } catch { /* storage disabled */ } }
  }

  private remember(plan: RoutePlanModel): void {
    if (plan.routePlanId == null) return;
    const rows = this.readCache();
    rows[plan.routePlanId] = { savedAt: Date.now(), plan };
    const newest = Object.entries(rows).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, 3);
    this.writeCache(Object.fromEntries(newest));
  }

  private invalidate(id?: number): void {
    this.cacheGeneration++;
    if (id === undefined) { try { localStorage.removeItem(this.cacheKey); } catch { /* HTTP remains available */ } return; }
    const rows = this.readCache();
    delete rows[id];
    this.writeCache(rows);
  }

  invalidateCache(): void { this.invalidate(); }

  generate(planDate: string, window: {startTime?:string;deadline?:string;orderIds?:number[]} = {}): Observable<RoutePlanModel> {
    return this.http.post<RoutePlanModel>(`${this.baseUrl}/generate`, { planDate, ...window }).pipe(tap(() => this.invalidate()));
  }

  recalculate(planDate: string, window: {startTime?:string;deadline?:string;orderIds?:number[];basePlanId?:number} = {}): Observable<RoutePlanModel> {
    return this.http.post<RoutePlanModel>(`${this.baseUrl}/recalculate`, { planDate, ...window }).pipe(tap(() => this.invalidate()));
  }

  list(date?: string): Observable<RoutePlanSummaryModel[]> {
    const currentResponse = this.currentResponse();
    return this.http.get<RoutePlanSummaryModel[]>(this.baseUrl, { params: date ? { date } : {} }).pipe(tap(plans => {
      if (!currentResponse()) return;
      const current = new Map(plans.map(plan => [plan.routePlanId, plan]));
      const rows = this.readCache();
      for (const [id, entry] of Object.entries(rows)) {
        const summary = current.get(Number(id));
        if (!entry?.plan || (summary && (summary.status !== entry.plan.status || summary.planDate !== entry.plan.planDate))) delete rows[id];
        else if (!summary && (!date || entry.plan.planDate === date)) delete rows[id];
      }
      this.writeCache(rows);
    }));
  }

  get(id: number, fresh = false): Observable<RoutePlanModel> {
    const currentResponse = this.currentResponse();
    const cached = this.readCache()[id];
    if (!fresh && cached?.plan?.routePlanId === id && cached.plan.status === 'GENERATED'
        && Array.isArray(cached.plan.jobs)
        && Number.isFinite(cached.savedAt) && Date.now() - cached.savedAt >= 0
        && Date.now() - cached.savedAt < this.cacheAgeMs) return of(cached.plan);
    return this.http.get<RoutePlanModel>(`${this.baseUrl}/${id}`).pipe(tap(plan => { if (currentResponse()) this.remember(plan); }));
  }

  select(id: number, assignments?:Array<{jobId:number;riderId:number}>): Observable<RoutePlanModel> {
    return this.http.post<RoutePlanModel>(`${this.baseUrl}/${id}/select`, assignments ? {assignments} : {}).pipe(tap(() => this.invalidate()));
  }

  acknowledgeMyJob(jobId:number):Observable<{acknowledged:boolean}> {
    return this.http.post<{acknowledged:boolean}>(`${environment.apiBaseUrl}/my-jobs/${jobId}/acknowledge`,{});
  }
  startMyJob(jobId:number):Observable<{started:boolean}> {
    return this.http.post<{started:boolean}>(`${environment.apiBaseUrl}/my-jobs/${jobId}/start`,{});
  }

  myJobs(date: string): Observable<Array<{ planId: number; job: DeliveryRouteModel; shop: { latitude: number; longitude: number; deliveryDeadline: string; shopName?: string; deliveryStartTime?: string } }>> {
    return this.http.get<Array<{ planId: number; job: DeliveryRouteModel; shop: { latitude: number; longitude: number; deliveryDeadline: string; shopName?: string; deliveryStartTime?: string } }>>(`${environment.apiBaseUrl}/my-jobs`, { params: { date } });
  }

  deliverMyStop(jobId: number, orderId: number): Observable<{ delivered: boolean }> {
    return this.http.post<{ delivered: boolean }>(`${environment.apiBaseUrl}/my-jobs/${jobId}/stops/${orderId}/deliver`, {});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(tap(() => this.invalidate(id)));
  }
}
