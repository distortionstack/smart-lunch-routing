import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize, forkJoin, timeout } from 'rxjs';
import { BackendApiService } from './backend-api.service';
import { DEMO_CUSTOMERS, DEMO_ORDERS, DEMO_RIDERS } from './demo-data';
import { Customer, Order, RiderRoute, RoutePlan, RouteStop, SHOP } from './models';
import { ShopSettings, ShopSettingsApiService } from './shop-settings-api.service';
import { RoutePlanApiService } from './route-plan-api.service';
import { AuthService } from './auth.service';

const CUSTOMER_KEY = 'smart-lunch-customers-v1';
const PLAN_KEY = 'smart-lunch-plan-v1';

@Injectable({ providedIn: 'root' })
export class DeliveryService {
  readonly customers = signal<Customer[]>([]);
  readonly orders = signal<Order[]>([]);
  readonly riders = signal<typeof DEMO_RIDERS>([]);
  readonly plan = signal<RoutePlan | null>(null);
  readonly connecting = signal(false);
  readonly connectionError = signal('');
  readonly confirmedPlan = signal<RoutePlan | null>(null);
  readonly planHistory = signal<RoutePlan[]>([]);
  readonly pendingOrders = computed(() => this.orders().filter((order) => order.status === 'pending'));
  readonly dispatchCustomers = computed(() => {
    const customerIds = new Set(this.pendingOrders().map(order => order.customerId));
    return this.customers().filter(customer => customerIds.has(customer.id));
  });
  readonly pendingBoxes = computed(() => this.pendingOrders().reduce((sum, order) => sum + order.boxes, 0));
  /** Only an API-confirmed snapshot is ready for dispatch. */
  readonly usingBackend = signal(false);
  /** ค่าตั้งร้านจาก backend (null = ยังโหลดไม่ได้ ใช้ค่า default เดียวกับ backend seed) */
  readonly settings = signal<ShopSettings | null>(null);
  readonly dataRevision = signal(0);
  private readonly api = inject(BackendApiService, { optional: true });
  private readonly settingsApi = inject(ShopSettingsApiService, { optional: true });
  private readonly routePlans = inject(RoutePlanApiService, { optional: true });
  private readonly auth = inject(AuthService, { optional: true });
  private loadGeneration = 0;

  private currentResponse(): () => boolean {
    const generation = this.loadGeneration;
    const token = this.auth?.token();
    return () => generation === this.loadGeneration && token === this.auth?.token();
  }

  constructor() {
    // Retire legacy order/plan caches; never restore orders or their snapshots from storage.
    try { localStorage.removeItem('smart-lunch-orders-v1'); localStorage.removeItem(PLAN_KEY); }
    catch { /* API data remains usable when storage is unavailable. */ }
  }

  /**
   * Load one complete API snapshot; failed/partial loads cannot become dispatch data.
   */
  connect(refresh = false): void {
    if (!this.api || (this.usingBackend() && !refresh)) return;
    this.loadGeneration++;
    const current = this.currentResponse();
    this.connecting.set(true);
    this.connectionError.set('');
    forkJoin({
      customers: this.api.listCustomers(),
      orders: this.api.listOrders(),
      riders: this.api.listRiders(),
    }).pipe(timeout(15000), finalize(() => { if (current()) this.connecting.set(false); })).subscribe({ next: (data) => {
      if (!current()) return;
      this.customers.set(data.customers);
      this.orders.set(data.orders);
      this.riders.set(data.riders);
      // A persisted local preview has no backend geometry or durable status.
      // Load the saved backend plan afresh on the dispatch page instead.
      this.plan.set(null);
      this.confirmedPlan.set(null);
      try { localStorage.removeItem(PLAN_KEY); } catch { /* browser storage unavailable */ }
      this.usingBackend.set(true);
      this.dataRevision.update(value => value + 1);
    }, error: () => {
      if (!current()) return;
      this.customers.set([]);
      this.orders.set([]);
      this.riders.set([]);
      this.plan.set(null);
      this.confirmedPlan.set(null);
      this.usingBackend.set(false);
      this.connectionError.set('โหลดข้อมูลจัดส่งไม่สำเร็จ กรุณาลองเชื่อมต่ออีกครั้ง');
      this.dataRevision.update(value => value + 1);
    } });
    // ค่าตั้งร้านแยกเส้นต่างหาก — พังก็แค่ใช้ default ไม่กระทบข้อมูลหลัก
    this.settingsApi?.get().subscribe({
      next: (settings) => { if (current()) this.settings.set(settings); },
      error: (error) => console.warn('[delivery] โหลดค่าตั้งร้านไม่สำเร็จ ใช้ค่า default:', error),
    });
  }

  saveCustomer(input: Omit<Customer, 'id'> & { id?: string }): void {
    if (this.usingBackend() && this.api) {
      const current = this.currentResponse();
      const payload = { name: input.name, phone: input.phone, address: input.address, lat: input.lat, lng: input.lng };
      const request = input.id ? this.api.updateCustomer(input.id, payload) : this.api.createCustomer(payload);
      request.subscribe({
        next: (saved) => {
          if (!current()) return;
          this.customers.update((list) =>
            input.id ? list.map((item) => (item.id === saved.id ? saved : item)) : [...list, saved],
          );
          this.persist(CUSTOMER_KEY, this.customers());
          this.routePlans?.invalidateCache();
          this.clearPlan();
        },
        error: (error) => console.error('[delivery] บันทึกลูกค้าลง backend ไม่สำเร็จ:', error),
      });
      return;
    }
    const current = this.customers();
    const customer: Customer = { ...input, id: input.id || `c-${Date.now()}` };
    const next = input.id ? current.map((item) => item.id === input.id ? customer : item) : [...current, customer];
    this.customers.set(next);
    this.persist(CUSTOMER_KEY, next);
    this.clearPlan();
  }

  deleteCustomer(id: string): boolean {
    if (this.orders().some((order) => order.customerId === id)) return false;
    if (this.usingBackend() && this.api) {
      const current = this.currentResponse();
      this.api.deleteCustomer(id).subscribe({
        next: () => { if (current()) this.customerDeleted(id); },
        // 409 = backend บอกว่ามีออเดอร์อ้างอิงอยู่ — คงรายการไว้แล้วให้ toast ฝั่ง UI ตัดสินใจ
        error: (error) => console.error('[delivery] ลบลูกค้าใน backend ไม่สำเร็จ:', error),
      });
      return true;
    }
    this.customerDeleted(id);
    return true;
  }

  customerDeleted(id: string): void {
    this.customers.update((list) => list.filter((customer) => customer.id !== id));
    this.persist(CUSTOMER_KEY, this.customers());
    this.routePlans?.invalidateCache();
    this.clearPlan();
  }

  refresh(): void {
    this.routePlans?.invalidateCache();
    this.connect(true);
  }

  orderDeleted(id: string): void {
    this.ordersDeleted([id]);
  }

  ordersDeleted(ids: readonly string[]): void {
    const removed = new Set(ids);
    this.orders.update((list) => list.filter((order) => !removed.has(order.id)));
    this.routePlans?.invalidateCache();
    this.clearPlan();
  }

  calculateRoutes(alternative = false): RoutePlan {
    const plan = this.previewRoutes(alternative ? (this.plan()?.version || 1) + 1 : 1);
    this.choosePlan(plan);
    return plan;
  }

  previewRoutes(version: number): RoutePlan {
    const orders = this.pendingOrders();
    const customerById = new Map(this.customers().map((customer) => [customer.id, customer]));
    // ข้ามออเดอร์ที่ลูกค้าถูกลบไปแล้ว แทนที่จะพังทั้งแผน
    const known = orders.filter((order) => customerById.has(order.customerId));
    // ไม่มีไรเดอร์เลยก็คืนแผนว่าง หน้าเว็บยังแสดงผลได้ตามปกติ
    if (!known.length || !this.riders().length) {
      return this.emptyPlan(version);
    }
    const sorted = [...known].sort((a, b) => {
      const ca = customerById.get(a.customerId)!;
      const cb = customerById.get(b.customerId)!;
      return Math.atan2(ca.lat - SHOP.lat, ca.lng - SHOP.lng) - Math.atan2(cb.lat - SHOP.lat, cb.lng - SHOP.lng);
    });
    const offset = sorted.length ? (version - 1) % sorted.length : 0;
    const rotated = [...sorted.slice(offset), ...sorted.slice(0, offset)];
    const groups = Array.from({ length: Math.ceil(rotated.length / 3) }, (_, index) => rotated.slice(index * 3, index * 3 + 3));
    const routes = groups.map((group, index) => this.buildRoute(group, index, customerById));
    const plan: RoutePlan = {
      version,
      generatedAt: new Date().toISOString(),
      routes,
      totalDistanceKm: this.round(routes.reduce((sum, route) => sum + route.distanceKm, 0)),
      totalDurationMinutes: Math.round(routes.reduce((sum, route) => sum + route.durationMinutes, 0)),
      deliveryCost: this.round(routes.reduce((sum, route) => sum + route.deliveryCost, 0)),
      revenue: routes.reduce((sum, route) => sum + route.revenue, 0),
      foodCost: routes.reduce((sum, route) => sum + route.foodCost, 0),
      profit: this.round(routes.reduce((sum, route) => sum + route.profit, 0)),
      deadlineSafe: routes.every((route) => route.deadlineSafe),
    };
    return plan;
  }

  private emptyPlan(version: number): RoutePlan {
    return {
      version,
      generatedAt: new Date().toISOString(),
      routes: [],
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      deliveryCost: 0,
      revenue: 0,
      foodCost: 0,
      profit: 0,
      deadlineSafe: true,
    };
  }

  choosePlan(plan: RoutePlan): void {
    this.plan.set(plan);
    this.confirmedPlan.set(null);
  }

  confirmPlan(): void {
    const plan = this.plan();
    if (!plan) return;
    this.confirmedPlan.set(plan);
    this.planHistory.update(history => [plan, ...history]);
  }

  routeForJobCode(jobCode: string): RiderRoute | null {
    return this.confirmedPlan()?.routes.find((route) => route.rider.jobCode.toLowerCase() === jobCode.trim().toLowerCase()) || null;
  }

  customerFor(order: Order): Customer | undefined {
    return this.customers().find((customer) => customer.id === order.customerId);
  }

  /** Explicit in-memory fixtures for legacy calculation tests; never an API-error fallback. */
  resetDemo(): void {
    this.usingBackend.set(false);
    this.customers.set(structuredClone(DEMO_CUSTOMERS));
    this.orders.set(structuredClone(DEMO_ORDERS));
    this.riders.set(structuredClone(DEMO_RIDERS));
    this.plan.set(null);
    this.confirmedPlan.set(null);
    this.planHistory.set([]);
    this.persist(CUSTOMER_KEY, this.customers());
    localStorage.removeItem(PLAN_KEY);
  }

  private buildRoute(orders: Order[], riderIndex: number, customerById: Map<string, Customer>): RiderRoute {
    const remaining = orders.map((order) => ({ order, customer: customerById.get(order.customerId)! }));
    const stops: RouteStop[] = [];
    let current: { lat: number; lng: number } = { lat: SHOP.lat, lng: SHOP.lng };
    let totalDistance = 0;
    while (remaining.length) {
      remaining.sort((a, b) => this.distance(current, a.customer) - this.distance(current, b.customer));
      const next = remaining.shift()!;
      const leg = this.distance(current, next.customer);
      totalDistance += leg;
      const elapsedMinutes = totalDistance / 30 * 60;
      stops.push({
        ...next,
        sequence: stops.length + 1,
        distanceFromPreviousKm: this.round(leg),
        arrivalTime: this.timeAfter('11:30', elapsedMinutes),
      });
      current = next.customer;
    }
    const totalBoxes = orders.reduce((sum, order) => sum + order.boxes, 0);
    const distanceKm = this.round(totalDistance);
    const durationMinutes = Math.ceil(distanceKm / 30 * 60);
    // สูตรเดียวกับ backend cost-calculator: ฐาน + กม. × ต่อกม.ต่อกล่อง × จำนวนกล่อง (ตามสเปก Project.pdf)
    const pricing = this.settings();
    const deliveryCost = this.round((pricing?.riderBaseCost ?? 15) + distanceKm * (pricing?.riderCostPerKm ?? 2) * totalBoxes);
    const revenue = totalBoxes * (pricing?.boxSalePrice ?? 65);
    const foodCost = totalBoxes * (pricing?.boxFoodCost ?? 40);
    return {
      rider: this.riders()[riderIndex % this.riders().length],
      stops,
      totalBoxes,
      distanceKm,
      durationMinutes,
      deliveryCost,
      revenue,
      foodCost,
      profit: this.round(revenue - foodCost - deliveryCost),
      deadlineSafe: durationMinutes <= 60,
    };
  }

  private distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const radius = 6371;
    const dLat = this.toRadians(b.lat - a.lat);
    const dLng = this.toRadians(b.lng - a.lng);
    const lat1 = this.toRadians(a.lat);
    const lat2 = this.toRadians(b.lat);
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  private timeAfter(start: string, minutes: number): string {
    const [hours, mins] = start.split(':').map(Number);
    const total = hours * 60 + mins + Math.ceil(minutes);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  private clearPlan(): void {
    this.plan.set(null);
    this.confirmedPlan.set(null);
    localStorage.removeItem(PLAN_KEY);
  }

  private persist(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { console.warn('[delivery] บันทึก cache ในเครื่องไม่ได้ จะใช้ข้อมูลที่อยู่ในหน่วยความจำ'); }
  }

  clearForLogout(): void {
    this.loadGeneration++;
    this.customers.set([]);
    this.orders.set([]);
    this.riders.set([]);
    this.plan.set(null);
    this.confirmedPlan.set(null);
    this.planHistory.set([]);
    this.settings.set(null);
    this.usingBackend.set(false);
    this.connecting.set(false);
    this.connectionError.set('');
    this.routePlans?.invalidateCache();
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private toRadians(value: number): number {
    return value * Math.PI / 180;
  }
}
