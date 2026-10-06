import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CustomersApiService } from './customer-api.service';
import { OrderApiService } from './order-api.service';

describe('nearby HTTP queries', () => {
  beforeEach(() => TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]}));
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('uses 1km for customers and 2km for orders, with no date/status restriction by default', () => {
    const http=TestBed.inject(HttpTestingController);
    TestBed.inject(CustomersApiService).nearby().subscribe();
    const customer=http.expectOne(r=>r.url==='/api/customers/nearby');
    expect(customer.request.params.get('radiusKm')).toBe('1');
    expect(customer.request.params.has('lat')).toBe(false);
    expect(customer.request.params.has('lng')).toBe(false);
    customer.flush([]);
    TestBed.inject(OrderApiService).nearby().subscribe();
    const orders=http.expectOne(r=>r.url==='/api/orders/nearby');
    expect(orders.request.params.get('radiusKm')).toBe('2');
    expect(orders.request.params.has('lat')).toBe(false);
    expect(orders.request.params.has('date')).toBe(false);
    expect(orders.request.params.has('status')).toBe(false);
    orders.flush([]);
  });
  it('sends optional order date and status filters', () => {
    TestBed.inject(OrderApiService).nearby('2026-10-05','CANCELLED').subscribe();
    const request=TestBed.inject(HttpTestingController).expectOne(r=>r.url==='/api/orders/nearby');
    expect(request.request.params.get('date')).toBe('2026-10-05');
    expect(request.request.params.get('status')).toBe('CANCELLED');
    request.flush([]);
  });
  it('sends custom customer and order radii without client coordinates',()=>{
    const http=TestBed.inject(HttpTestingController);
    TestBed.inject(CustomersApiService).nearby(0.5).subscribe();
    const customers=http.expectOne(r=>r.url==='/api/customers/nearby');
    expect(customers.request.params.get('radiusKm')).toBe('0.5');customers.flush([]);
    TestBed.inject(OrderApiService).nearby(undefined,undefined,100).subscribe();
    const orders=http.expectOne(r=>r.url==='/api/orders/nearby');
    expect(orders.request.params.get('radiusKm')).toBe('100');orders.flush([]);
  });
});
