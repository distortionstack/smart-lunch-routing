import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NEVER, Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeliveryComponent } from './delivery.component';
import { DeliveryService } from '../../core/delivery.service';
import { RoutePlanApiService } from '../../core/route-plan-api.service';

describe('DeliveryComponent saved plans loading', () => {
  let fixture: ComponentFixture<DeliveryComponent>;
  let component: DeliveryComponent;
  let listSpy: ReturnType<typeof vi.fn>;
  let getSpy: ReturnType<typeof vi.fn>;
  let deleteSpy: ReturnType<typeof vi.fn>;
  let confirmSpy: ReturnType<typeof vi.fn>;
  let selectSpy: ReturnType<typeof vi.fn>;
  let generateSpy: ReturnType<typeof vi.fn>;
  let recalculateSpy: ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(listReturn: any, backendReady: boolean, selectReturn = NEVER, getReturn: any = NEVER) {
    const usingBackend = signal(backendReady);
    const plan = signal<any>(null);
    listSpy = vi.fn().mockReturnValue(listReturn);
    getSpy = vi.fn().mockReturnValue(getReturn);
    deleteSpy = vi.fn().mockReturnValue(NEVER);
    confirmSpy = vi.fn();
    selectSpy=vi.fn().mockReturnValue(selectReturn);
    generateSpy=vi.fn().mockReturnValue(NEVER);
    recalculateSpy=vi.fn().mockReturnValue(NEVER);
    TestBed.configureTestingModule({
      imports: [DeliveryComponent],
      providers: [
        provideRouter([]),
        { provide: DeliveryService, useValue: { refresh: vi.fn(), connecting: signal(false), connectionError: signal(''), dataRevision: signal(0), usingBackend, settings: signal(null), customers: signal([]), dispatchCustomers: () => [], orders: signal([]), riders: signal([]), plan, confirmedPlan: signal(null), planHistory: signal([]), pendingOrders: () => [], pendingBoxes: () => 0, customerFor: () => null, calculateRoutes: () => {}, choosePlan: (value: any) => plan.set(value), confirmPlan: confirmSpy } },
        { provide: RoutePlanApiService, useValue: { list: listSpy, get: getSpy, select: selectSpy, delete: deleteSpy, generate: generateSpy, recalculate: recalculateSpy } },
      ],
    });
    fixture = TestBed.createComponent(DeliveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return usingBackend;
  }

  it('shows error after 15s timeout when request hangs', async () => {
    vi.useFakeTimers();
    setup(NEVER, true);
    expect(component.loadingPlans).toBe(true);
    expect(listSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(16000);
    fixture.detectChanges();
    expect(component.loadingPlans).toBe(false);
    expect(component.plansError).toContain('โหลดใบงานไม่สำเร็จ');
  });

  it('ends generation after 30s and never creates a local substitute', async () => {
    vi.useFakeTimers();
    setup(of([]), true);
    vi.spyOn(component, 'canCalculate').mockReturnValue(true);
    component.calculate();
    component.calculate();
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(component.calculating).toBe(true);
    await vi.advanceTimersByTimeAsync(31000);
    expect(component.calculating).toBe(false);
    expect(component.store.plan()).toBeNull();
    expect(component.plansError).toContain('หมดเวลารอ');
  });

  it('does not fall back locally on API failure or disconnection', () => {
    const connected = setup(of([]), true);
    vi.spyOn(component, 'canCalculate').mockReturnValue(true);
    generateSpy.mockReturnValue(throwError(() => ({ status: 503 })));
    component.calculate();
    expect(component.store.plan()).toBeNull();
    expect(component.plansError).toContain('คำนวณไม่สำเร็จ');
    connected.set(false);
    component.calculate();
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(component.plansError).toContain('เชื่อมต่อ');
  });

  it('renders an asynchronous alternative in zoneless mode without another user click', async () => {
    setup(of([]), true);
    const backend={routePlanId:17,status:'GENERATED',jobs:[],estimatedFinishTime:'11:05',startTime:'11:00',deliveryDeadline:'14:00',totalDistanceKm:1,totalDeliveryCost:15,totalRevenue:65,totalFoodCost:40,estimatedProfit:10};
    getSpy.mockReturnValue(of(backend));
    component.viewSavedPlan(17);
    await fixture.whenStable();
    expect(component.roundStart).toBe('11:00');
    expect(component.roundDeadline).toBe('14:00');
    const returned=new Subject<any>();
    recalculateSpy.mockReturnValue(returned);
    component.compare();
    expect(recalculateSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ basePlanId: 17, startTime: '11:00', deadline: '14:00' }));
    await fixture.whenStable();
    returned.next({...backend,routePlanId:18});returned.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.comparison')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('เลือกแผนใหม่');
    expect(component.calculating).toBe(false);
  });

  it('sends the current draft ID and releases the compare button on timeout', async () => {
    vi.useFakeTimers();
    setup(of([]), true);
    component.backendPlanId = 17;
    component.selectedOrderIds = [3, 4];
    component.compare();
    expect(recalculateSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ basePlanId: 17, orderIds: [3, 4] }));
    await vi.advanceTimersByTimeAsync(31000);
    expect(component.calculating).toBe(false);
    expect(component.candidate).toBeNull();
    expect(component.plansError).toContain('หมดเวลารอ');
    recalculateSpy.mockReturnValue(throwError(() => ({status:422})));
    component.compare();
    expect(component.plansError).toContain('ไม่พบแผนทางเลือก');
    expect(component.backendPlanId).toBe(17);
  });

  it('loads plans when backend becomes ready after init (effect)', async () => {
    vi.useFakeTimers();
    const usingBackend = setup(of([]), false);
    expect(listSpy).not.toHaveBeenCalled();
    usingBackend.set(true);
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(listSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('does not refire spuriously over time', async () => {
    vi.useFakeTimers();
    setup(of([]), true);
    expect(listSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    fixture.detectChanges();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(60000);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(component.plansError).toBeNull();
  });

  it('loads the selected plan detail after the saved-plan list', () => {
    setup(of([{ routePlanId: 5, status: 'SELECTED' }]), true);
    expect(getSpy).toHaveBeenCalledWith(5);
  });
  it('rejects duplicate riders and sends the complete assignment with confirmation',()=>{
    setup(of([]),true);
    component.backendPlanId=5;
    component.backendPlan={status:'GENERATED',jobs:[{jobId:7},{jobId:8}]} as never;
    component.store.plan.set({deadlineSafe:true} as never);
    component.reviewing=true;
    component.riderAssignments={7:1,8:1};
    component.confirm();
    expect(selectSpy).not.toHaveBeenCalled();
    component.riderAssignments={7:2,8:1};
    component.confirm();
    expect(selectSpy).toHaveBeenCalledWith(5,[{jobId:7,riderId:2},{jobId:8,riderId:1}]);
    component.confirm();
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it('does not automatically open an invalidated saved draft', () => {
    setup(of([{ routePlanId: 5, status: 'REJECTED' }]), true);
    expect(getSpy).not.toHaveBeenCalled();
    expect(component.backendPlanId).toBeNull();
    expect(component.mapJobs()).toBeNull();
  });

  it('clears the previous backend identity when choosing a local candidate', () => {
    setup(of([]), true);
    component.backendPlanId = 5;
    component.backendPlan = { status: 'GENERATED', jobs: [] } as never;
    component.candidate = { deadlineSafe: true } as never;
    component.chooseCandidate();
    expect(component.backendPlanId).toBeNull();
    expect(component.backendPlan).toBeNull();
    component.startReview();
    component.confirm();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(component.plansError).toContain('ตัวอย่างเท่านั้น');
  });

  it('opens a saved draft automatically and reveals its map only after a user click', async () => {
    vi.useFakeTimers();
    const geometry = { type: 'LineString', coordinates: [[103.25286, 16.24631], [103.2531, 16.2469]] };
    setup(of([{ routePlanId: 12, status: 'GENERATED' }]), true, NEVER, of({
      routePlanId: 12, planDate: '2026-10-04', status: 'GENERATED', routingSource: 'ROAD',
      approximate: false, riderCount: 1, totalDistanceKm: 1, estimatedFinishTime: '11:32',
      totalBoxes: 1, totalRevenue: 65, totalFoodCost: 40, totalDeliveryCost: 17,
      estimatedProfit: 8, jobs: [{ riderIndex: 0, riderId: 1, totalOrders: 1, totalBoxes: 1,
        distanceKm: 1, durationMinutes: 2, estimatedStartTime: '11:30',
        estimatedFinishTime: '11:32', deliveryCost: 17, geometry, approximate: false,
        stops: [{ sequence: 1, orderId: 1, customerId: 1, customerName: 'Test', phone: '',
          address: '', latitude: 16.2469, longitude: 103.2531, boxCount: 1,
          distanceFromPreviousKm: 1, travelTimeFromPreviousMin: 2,
          estimatedArrivalTime: '11:32', deliveryStatus: 'WAITING' }] }],
    }));
    expect(getSpy).toHaveBeenCalledWith(12);
    expect(component.backendPlanId).toBe(12);
    expect(component.mapJobs()?.[0]?.geometry).toEqual(geometry);
    expect(component.store.plan()?.routes[0]?.stops[0]?.deliveryStatus).toBe('WAITING');
    const panel = fixture.nativeElement.querySelector('[aria-labelledby="operations-map-title"]');
    const scroll = vi.fn();
    panel.scrollIntoView = scroll;
    await vi.advanceTimersByTimeAsync(0);
    expect(scroll).not.toHaveBeenCalled();
    component.viewSavedPlan(12, false, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(scroll).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(panel);
  });

  it('does not show a confirmed plan when the backend rejects selection', () => {
    setup(of([]), true, throwError(() => ({ status: 422 })));
    component.store.plan.set({ deadlineSafe: true } as never);
    component.backendPlanId = 5;
    component.backendPlan = { status: 'GENERATED' } as never;
    component.reviewing = true;
    component.confirm();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(component.plansError).toContain('ยืนยันใบงานไม่สำเร็จ');
  });

  it('removes a newly generated backend draft when the comparison is discarded', () => {
    setup(of([]), true);
    component.candidate = { deadlineSafe: true } as never;
    (component as any).candidateBackend = { routePlanId: 23 };
    deleteSpy.mockReturnValue(of(undefined));

    component.discardCandidate();

    expect(deleteSpy).toHaveBeenCalledWith(23);
    expect(component.candidate).toBeNull();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });
});
