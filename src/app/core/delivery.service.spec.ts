import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeliveryService } from './delivery.service';
import { todayLocal } from './backend-api.service';
import { AuthService } from './auth.service';

describe('DeliveryService route planning', () => {
  let service: DeliveryService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DeliveryService);
    http = TestBed.inject(HttpTestingController);
    service.resetDemo();
  });

  afterEach(() => {
    http.verify();
  });

  it('assigns no more than three customer orders to each rider', () => {
    const plan = service.calculateRoutes();
    expect(plan.routes.length).toBeGreaterThan(0);
    expect(plan.routes.every((route) => route.stops.length <= 3)).toBe(true);
    expect(plan.routes.reduce((sum, route) => sum + route.stops.length, 0)).toBe(service.pendingOrders().length);
  });

  it('uses the backend revenue, food-cost, and rider-cost formula', () => {
    const plan = service.calculateRoutes();
    expect(plan.revenue).toBe(service.pendingBoxes() * 65);
    expect(plan.foodCost).toBe(service.pendingBoxes() * 40);
    expect(plan.profit).toBeCloseTo(plan.revenue - plan.foodCost - plan.deliveryCost, 2);
    for (const route of plan.routes) {
      // สูตรเดียวกับ backend cost-calculator: ฐาน + กม. × ต่อกม.ต่อกล่อง × จำนวนกล่อง
      expect(route.deliveryCost).toBeCloseTo(15 + 2 * route.distanceKm * route.totalBoxes, 2);
    }
  });

  it('creates a versioned alternative plan', () => {
    service.calculateRoutes();
    const alternative = service.calculateRoutes(true);
    expect(alternative.version).toBe(2);
    expect(alternative.routes.flatMap((route) => route.stops).length).toBe(service.pendingOrders().length);
  });

  it('previews a different route without replacing the current plan', () => {
    const original = service.calculateRoutes();
    const alternative = service.previewRoutes(2);
    expect(alternative.version).toBe(2);
    expect(service.plan()).toEqual(original);
    expect(alternative.routes.length).toBe(9);
    expect(new Set(alternative.routes.map(route => route.rider.id)).size).toBe(9);
    expect(alternative.routes.every(route => route.stops.length <= 3)).toBe(true);
    service.choosePlan(alternative);
    expect(service.plan()?.version).toBe(2);
  });

  it('opens job codes only after confirmation and resets confirmation on plan changes', () => {
    const plan = service.calculateRoutes();
    const code = plan.routes[0].rider.jobCode;
    expect(service.routeForJobCode(code)).toBeNull();
    service.confirmPlan();
    expect(service.routeForJobCode(code)).toEqual(plan.routes[0]);
    expect(service.planHistory()).toHaveLength(1);
    service.choosePlan(service.previewRoutes(2));
    expect(service.routeForJobCode(code)).toBeNull();
    expect(service.planHistory()).toHaveLength(1);
  });

  it('invalidates a plan when customer details change', () => {
    service.calculateRoutes();
    const customer = service.customers()[0];
    service.saveCustomer({ ...customer, address: 'จุดส่งตัวอย่างที่แก้ไขแล้ว' });
    expect(service.plan()).toBeNull();
  });

  it('removes API-deleted orders and customers from the dispatch snapshot', () => {
    const order = service.orders()[0];
    const customer = service.customers().find(item => item.id === order.customerId)!;
    service.calculateRoutes();

    service.orderDeleted(order.id);
    expect(service.orders().some(item => item.id === order.id)).toBe(false);
    expect(service.plan()).toBeNull();
    expect(service.confirmedPlan()).toBeNull();

    service.calculateRoutes();
    service.customerDeleted(customer.id);
    expect(service.customers().some(item => item.id === customer.id)).toBe(false);
    expect(service.plan()).toBeNull();
  });

  it('returns an empty plan instead of crashing when there are no orders', () => {
    service.orders.set([]);
    expect(service.customers().length).toBeGreaterThan(0);
    expect(service.dispatchCustomers()).toEqual([]);
    const plan = service.previewRoutes(1);
    expect(plan.routes).toEqual([]);
    expect(plan.totalDistanceKm).toBe(0);
    expect(plan.profit).toBe(0);
    expect(service.pendingOrders()).toEqual([]);
    expect(service.pendingBoxes()).toBe(0);
  });

  it('skips orders whose customer no longer exists instead of crashing', () => {
    service.orders.set([
      { id: 'ORD-GOOD', customerId: service.customers()[0].id, boxes: 2, status: 'pending', createdAt: new Date().toISOString() },
      { id: 'ORD-STALE', customerId: 'c-deleted', boxes: 3, status: 'pending', createdAt: new Date().toISOString() },
    ]);
    const plan = service.previewRoutes(1);
    expect(plan.routes.flatMap((route) => route.stops).map((stop) => stop.order.id)).toEqual(['ORD-GOOD']);
  });

  it('drops a stale saved plan that references deleted customers on startup', () => {
    const plan = service.calculateRoutes();
    expect(service.plan()).not.toBeNull();
    // ลบออเดอร์ก่อนจึงลบลูกค้าได้ แล้วจำลองเปิดหน้าใหม่ด้วยแผนเก่าค้างอยู่
    service.orders.set([]);
    localStorage.setItem('smart-lunch-orders-v1', JSON.stringify([]));
    for (const customer of service.customers()) service.deleteCustomer(customer.id);
    expect(service.customers()).toEqual([]);
    // เปิด service ตัวใหม่ทับ localStorage เดิม (แผนเก่าค้างอยู่) แทน new ตรง ๆ
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fresh = TestBed.inject(DeliveryService);
    expect(fresh.plan()).toBeNull();
    expect(fresh.pendingOrders()).toEqual([]);
    expect(() => fresh.previewRoutes(1)).not.toThrow();
  });

  describe('backend connection', () => {
    const apiCustomers = [
      { id: 1, name: 'สมชาย ใจดี', phone: '0812345678', address: 'ขอนแก่น', lat: 16.2469, lng: 103.2531 },
    ];
    const apiOrders = [{ id: 11, customerId: 1, boxes: 2, status: 'PENDING', orderDate: '2026-09-30' }];
    const apiRiders = [{ id: 5, name: 'Rider Five', phone: '0810000005', isAvailable: true }];
    const apiSettings = {
      settingId: 1, shopName: 'ครัวเที่ยงตรง', latitude: 16.24631, longitude: 103.25286,
      deliveryStartTime: '11:30:00', deliveryDeadline: '12:30:00', maxOrdersPerRider: 3,
      riderSpeedKmh: 30, boxSalePrice: 65, boxFoodCost: 40, riderBaseCost: 15, riderCostPerKm: 2,
    };

    it('replaces demo data with backend data on connect', () => {
      expect(service.usingBackend()).toBe(false);
      service.plan.set({ version: 99 } as never);
      localStorage.setItem('smart-lunch-plan-v1', '{"version":99}');
      service.connect();

      http.expectOne('/api/customers').flush(apiCustomers);
      http.expectOne(`/api/orders?date=${todayLocal()}`).flush(apiOrders);
      http.expectOne('/api/riders').flush(apiRiders);
      http.expectOne('/api/settings').flush(apiSettings);

      expect(service.usingBackend()).toBe(true);
      expect(service.customers().map((customer) => customer.id)).toEqual(['1']);
      expect(service.orders().map((order) => order.id)).toEqual(['11']);
      expect(service.riders().map((rider) => rider.id)).toEqual(['5']);
      expect(service.settings()).toEqual(apiSettings);
      expect(service.plan()).toBeNull();
      expect(localStorage.getItem('smart-lunch-plan-v1')).toBeNull();
      expect(localStorage.getItem('smart-lunch-orders-v1')).toBeNull();
    });

    it('clears stale data instead of using demo orders when the backend is unreachable', () => {
      service.connect();

      http.expectOne('/api/customers').flush(apiCustomers);
      http.expectOne('/api/riders').flush(apiRiders);
      http.expectOne('/api/settings').flush({ message: 'down' }, { status: 500, statusText: 'Error' });
      http.expectOne(`/api/orders?date=${todayLocal()}`).flush({ message: 'down' }, { status: 500, statusText: 'Error' });

      expect(service.usingBackend()).toBe(false);
      expect(service.customers()).toEqual([]);
      expect(service.orders()).toEqual([]);
      expect(service.connectionError()).toContain('ไม่สำเร็จ');
      expect(service.connecting()).toBe(false);
      expect(service.settings()).toBeNull();
    });

    it('ignores in-flight data after logout and leaves storage cleared', () => {
      service.connect();
      TestBed.inject(AuthService).clear();
      service.clearForLogout();
      http.expectOne('/api/customers').flush(apiCustomers);
      http.expectOne(`/api/orders?date=${todayLocal()}`).flush(apiOrders);
      http.expectOne('/api/riders').flush(apiRiders);
      http.expectOne('/api/settings').flush(apiSettings);
      expect(service.customers()).toEqual([]);
      expect(service.orders()).toEqual([]);
      expect(service.settings()).toBeNull();
      expect(service.usingBackend()).toBe(false);
      expect(localStorage.getItem('smart-lunch-customers-v1')).toBeNull();
    });

    it('refreshes connected data and clears the old route after a mutation', () => {
      service.connect();
      http.expectOne('/api/customers').flush(apiCustomers);
      http.expectOne(`/api/orders?date=${todayLocal()}`).flush(apiOrders);
      http.expectOne('/api/riders').flush(apiRiders);
      http.expectOne('/api/settings').flush(apiSettings);
      const revision = service.dataRevision();
      service.plan.set({ version: 99 } as never);
      service.refresh();
      http.expectOne('/api/customers').flush(apiCustomers);
      http.expectOne(`/api/orders?date=${todayLocal()}`).flush([]);
      http.expectOne('/api/riders').flush(apiRiders);
      http.expectOne('/api/settings').flush(apiSettings);
      expect(service.pendingOrders()).toEqual([]);
      expect(service.plan()).toBeNull();
      expect(service.dataRevision()).toBe(revision + 1);
    });

    it('does not mix a partial backend response with old local data', () => {
      service.connect();
      http.expectOne('/api/customers').flush(apiCustomers);
      http.expectOne('/api/riders').flush(apiRiders);
      http.expectOne('/api/settings').flush(apiSettings);
      http.expectOne(`/api/orders?date=${todayLocal()}`).flush({ message: 'down' }, { status: 500, statusText: 'Error' });
      expect(service.usingBackend()).toBe(false);
      expect(service.customers()).toEqual([]);
      expect(service.orders()).toEqual([]);
    });

    it('never restores legacy order/plan storage or starts with demo orders', () => {
      localStorage.setItem('smart-lunch-orders-v1', JSON.stringify(apiOrders));
      localStorage.setItem('smart-lunch-plan-v1', JSON.stringify({ version: 99, routes: [] }));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      service = TestBed.inject(DeliveryService);
      http = TestBed.inject(HttpTestingController);
      expect(service.orders()).toEqual([]);
      expect(service.customers()).toEqual([]);
      expect(service.riders()).toEqual([]);
      expect(service.plan()).toBeNull();
      expect(localStorage.getItem('smart-lunch-orders-v1')).toBeNull();
      expect(localStorage.getItem('smart-lunch-plan-v1')).toBeNull();
    });

    it('times out an unresponsive snapshot without exposing demo orders', async () => {
      vi.useFakeTimers();
      try {
        service.connect();
        http.match(req => ['/api/customers', '/api/orders', '/api/riders'].includes(req.url));
        http.expectOne('/api/settings').flush(apiSettings);
        await vi.advanceTimersByTimeAsync(15000);
        expect(service.connecting()).toBe(false);
        expect(service.usingBackend()).toBe(false);
        expect(service.orders()).toEqual([]);
        expect(service.connectionError()).toContain('ไม่สำเร็จ');
      } finally { vi.useRealTimers(); }
    });

    it('clears an old confirmed snapshot on refresh failure and recovers on retry', () => {
      const load = () => {
        http.expectOne('/api/customers').flush(apiCustomers);
        http.expectOne('/api/riders').flush(apiRiders);
        http.expectOne('/api/settings').flush(apiSettings);
      };
      service.connect(); load(); http.expectOne(`/api/orders?date=${todayLocal()}`).flush(apiOrders);
      service.plan.set({ version: 99 } as never);
      service.refresh(); load();
      http.expectOne(`/api/orders?date=${todayLocal()}`).flush({}, { status: 500, statusText: 'Error' });
      expect(service.orders()).toEqual([]);
      expect(service.plan()).toBeNull();
      expect(service.usingBackend()).toBe(false);
      service.refresh(); load(); http.expectOne(`/api/orders?date=${todayLocal()}`).flush(apiOrders);
      expect(service.usingBackend()).toBe(true);
      expect(service.connectionError()).toBe('');
      expect(service.orders().map(order => order.id)).toEqual(['11']);
      expect(localStorage.getItem('smart-lunch-orders-v1')).toBeNull();
      service.choosePlan({ version: 2, routes: [] } as never);
      expect(localStorage.getItem('smart-lunch-plan-v1')).toBeNull();
    });

    it('saves a new customer through the backend when connected', () => {
      service.connect();
      http.expectOne('/api/customers').flush(apiCustomers);
      http.expectOne(`/api/orders?date=${todayLocal()}`).flush(apiOrders);
      http.expectOne('/api/riders').flush(apiRiders);
      http.expectOne('/api/settings').flush(apiSettings);
      expect(service.usingBackend()).toBe(true);

      service.saveCustomer({ name: 'คนใหม่', phone: '0899999999', address: '', lat: 16.24, lng: 103.25 });
      const request = http.expectOne('/api/customers');
      expect(request.request.method).toBe('POST');
      request.flush({ id: 99, name: 'คนใหม่', phone: '0899999999', address: null, lat: 16.24, lng: 103.25 });

      expect(service.customers().some((customer) => customer.id === '99')).toBe(true);
    });
  });
});
