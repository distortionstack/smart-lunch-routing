import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { RoutePlanApiService } from './route-plan-api.service';
import { RoutePlanModel } from './route-plan.models';

const PLAN: RoutePlanModel = {
  routePlanId: 2,
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
  jobs: [],
};

describe('RoutePlanApiService', () => {
  let api: RoutePlanApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(RoutePlanApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('posts generate and passes the backend plan through untouched', () => {
    api.generate('2026-09-20').subscribe((plan) => {
      expect(plan.routePlanId).toBe(2);
      expect(plan.estimatedProfit).toBe(42.8);
    });
    const request = httpMock.expectOne('/api/route-plans/generate');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ planDate: '2026-09-20' });
    request.flush(PLAN);
  });

  it('posts recalculate to create a new plan', () => {
    api.recalculate('2026-09-20').subscribe((plan) => expect(plan.routePlanId).toBe(2));
    const request = httpMock.expectOne('/api/route-plans/recalculate');
    expect(request.request.method).toBe('POST');
    request.flush(PLAN);
  });

  it('reuses a recent plan detail and invalidates it after selecting', () => {
    api.get(2).subscribe(plan => expect(plan.routePlanId).toBe(2));
    httpMock.expectOne('/api/route-plans/2').flush(PLAN);
    api.get(2).subscribe(plan => expect(plan.status).toBe('GENERATED'));
    httpMock.expectNone('/api/route-plans/2');
    api.select(2).subscribe();
    httpMock.expectOne('/api/route-plans/2/select').flush({ ...PLAN, status: 'SELECTED' });
    api.get(2).subscribe(plan => expect(plan.status).toBe('SELECTED'));
    httpMock.expectOne('/api/route-plans/2').flush({ ...PLAN, status: 'SELECTED' });
  });

  it('surfaces backend errors (e.g. no orders, infeasible) to the page', () => {
    let status: number | undefined;
    api.generate('2026-09-20').subscribe({
      next: () => expect.unreachable('expected an error'),
      error: (error) => {
        status = error.status;
      },
    });
    const request = httpMock.expectOne('/api/route-plans/generate');
    request.flush({ message: 'No pending orders for 2026-09-20' }, { status: 422, statusText: 'Unprocessable Entity' });
    expect(status).toBe(422);
  });

  it('does not restore a cleared cache when an old detail request finishes', () => {
    api.get(2).subscribe();
    api.invalidateCache();
    httpMock.expectOne('/api/route-plans/2').flush(PLAN);
    expect(localStorage.length).toBe(0);
    api.get(2).subscribe();
    httpMock.expectOne('/api/route-plans/2').flush(PLAN);
  });
});
