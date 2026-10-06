import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeliveryComponent } from '../pages/delivery/delivery.component';
import { CustomersComponent } from '../pages/customers/customers.component';
import { OrdersComponent } from '../pages/orders/orders.component';
import { RidersComponent } from '../pages/riders/riders.component';
import { DeliveryService } from './delivery.service';
import { BackendApiService, todayLocal } from './backend-api.service';
import { AuthService } from './auth.service';
import { RoutePlanApiService } from './route-plan-api.service';
import { ShopSettingsApiService } from './shop-settings-api.service';
import { CustomersApiService } from './customer-api.service';
import { OrderApiService } from './order-api.service';
import { RidersApiService } from './rider-api.service';
import type { RoutePlanModel } from './route-plan.models';

describe('audit fix regressions', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it.each([true, false])('ignores plan response after logout, destroy=%s', destroyed => {
    let token: string | null = 'owner-session';
    const returned = new Subject<RoutePlanModel>();
    TestBed.configureTestingModule({ imports: [DeliveryComponent], providers: [provideRouter([]),
      { provide: AuthService, useValue: { token: () => token } },
      { provide: BackendApiService, useValue: { listCustomers: () => of([]), listOrders: () => of([]), listRiders: () => of([]) } },
      { provide: ShopSettingsApiService, useValue: { get: () => NEVER } },
      { provide: RoutePlanApiService, useValue: { list: () => of([]), get: () => returned, invalidateCache: vi.fn() } },
    ] }).overrideComponent(DeliveryComponent, { set: { template: '' } });
    const fixture = TestBed.createComponent(DeliveryComponent); fixture.detectChanges();
    const store = TestBed.inject(DeliveryService);
    fixture.componentInstance.viewSavedPlan(17);
    if (destroyed) fixture.destroy();
    token = null; store.clearForLogout();
    returned.next({ routePlanId: 17, status: 'SELECTED', jobs: [] } as never); returned.complete();
    expect(store.plan()).toBeNull(); expect(store.confirmedPlan()).toBeNull();
    if (!destroyed) fixture.destroy();
  });
  function orders(api: object) {
    TestBed.configureTestingModule({ providers: [
      { provide: OrderApiService, useValue: { list: () => of([]), ...api } },
      { provide: CustomersApiService, useValue: { getCustomers: () => of([]) } },
      { provide: DeliveryService, useValue: { refresh: vi.fn(), ordersDeleted: vi.fn() } },
    ] });
    return TestBed.runInInjectionContext(() => new OrdersComponent());
  }
  it('does not replace the order form while a save is pending', () => {
    const returned = new Subject<unknown>(); const page = orders({ create: () => returned });
    page.startCreate(); page.draft.customerId = 1; page.save();
    const original = page.draft; page.startCreate(); page.cancel();
    expect(page.draft).toBe(original); expect(page.showForm).toBe(true);
    returned.next({}); returned.complete(); expect(page.showForm).toBe(false); expect(page.saving()).toBe(false);
  });
  it('submits simulation once and recovers on timeout', async () => {
    vi.useFakeTimers(); const simulate = vi.fn().mockReturnValue(NEVER); const page = orders({ simulate });
    page.simulate(); page.simulate(); expect(simulate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(16000); expect(page.saving()).toBe(false); expect(page.error()).toContain('หมดเวลา');
  });
  it('clears only visible simulated IDs, not hidden or real orders', () => {
    const clearSimulated = vi.fn().mockReturnValue(of({ deletedCount: 1 })); const page = orders({ clearSimulated });
    page.orders.set([7, 9, 10].map(id => ({ id, customerId: 1, boxes: 1, status: 'PENDING', orderDate: page.today, isSimulated: id !== 10 })));
    page.query = '7'; vi.spyOn(window, 'confirm').mockReturnValue(true); page.clearSimulated();
    expect(clearSimulated).toHaveBeenCalledWith([7]);
    expect(TestBed.inject(DeliveryService).ordersDeleted).toHaveBeenCalledWith(['7']);
  });
  it('shows the actual confirmed-plan conflict instead of duplicate phone', () => {
    const message = 'This data belongs to a confirmed delivery plan';
    TestBed.configureTestingModule({ providers: [
      { provide: CustomersApiService, useValue: { updateCustomer: () => throwError(() => ({ status: 409, error: { message } })) } },
      { provide: DeliveryService, useValue: {} },
    ] }); vi.spyOn(console, 'error').mockImplementation(() => {});
    const page = TestBed.runInInjectionContext(() => new CustomersComponent());
    page.edit({ id: '1', name: 'QA', phone: '0812345678', address: '', lat: 16, lng: 103 }); page.save();
    expect(page.error).toBe(message);
  });
  it('recovers rider management loading after a stalled request', async () => {
    vi.useFakeTimers(); TestBed.configureTestingModule({ providers: [
      { provide: RidersApiService, useValue: { getRiders: () => NEVER } }, { provide: DeliveryService, useValue: {} },
    ] }); const page = TestBed.runInInjectionContext(() => new RidersComponent()); page.reload();
    await vi.advanceTimersByTimeAsync(16000); expect(page.loading()).toBe(false); expect(page.error()).toContain('หมดเวลา');
  });
  it('renders shop prices instead of constants', () => {
    TestBed.configureTestingModule({ imports: [OrdersComponent], providers: [provideRouter([]),
      { provide: OrderApiService, useValue: { list: () => of([]) } },
      { provide: CustomersApiService, useValue: { getCustomers: () => of([]) } },
      { provide: DeliveryService, useValue: { settings: () => ({ boxSalePrice: 100, boxFoodCost: 60 }) } },
    ] }); const fixture = TestBed.createComponent(OrdersComponent); fixture.componentInstance.startCreate();
    fixture.componentInstance.draft.boxes = 2; fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('200 บาท'); expect(fixture.nativeElement.textContent).toContain('ต้นทุนอาหาร 120 บาท'); fixture.destroy();
  });
  it('uses Bangkok business dates independently of client timezone', () => {
    expect(todayLocal(new Date('2026-10-05T17:00:00Z'))).toBe('2026-10-06');
    expect(todayLocal(new Date('2026-10-05T16:59:59Z'))).toBe('2026-10-05');
  });
});
