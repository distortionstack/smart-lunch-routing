import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { OrdersComponent } from './orders.component';
import { OrderApiService } from '../../core/order-api.service';
import { CustomersApiService } from '../../core/customer-api.service';
import { DeliveryService } from '../../core/delivery.service';

describe('OrdersComponent radius search',()=>{
  it('searches all dates/statuses and ignores a late response from the old list',()=>{
    const late=new Subject<any[]>();
    const api={list:vi.fn().mockReturnValue(late),nearby:vi.fn().mockReturnValue(of([{id:7,customerId:3,boxes:1,status:'CANCELLED',orderDate:'2026-09-30',distanceKm:1.2}]))};
    TestBed.configureTestingModule({imports:[OrdersComponent],providers:[provideRouter([]),{provide:OrderApiService,useValue:api},{provide:CustomersApiService,useValue:{getCustomers:()=>of([])}},{provide:DeliveryService,useValue:{refresh:vi.fn()}}]});
    const fixture=TestBed.createComponent(OrdersComponent);
    fixture.detectChanges();
    const page=fixture.componentInstance;
    page.query='7';page.simFilter='real';page.statusFilter='PENDING';
    page.searchNearby(3.5);
    expect(page.query).toBe('7');
    expect(api.nearby).toHaveBeenCalledWith(undefined,undefined,3.5);
    expect(page.dateFilter).toBe('');
    expect(page.filteredOrders().map(o=>o.id)).toEqual([7]);
    late.next([{id:8}]);late.complete();
    expect(page.orders().map(o=>o.id)).toEqual([7]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1.200 กม.');
    expect(fixture.nativeElement.textContent).toContain('2026-09-30');
    page.clearNearby();
    expect(api.list).toHaveBeenLastCalledWith(page.today);
    page.feedback = 'บันทึกออเดอร์แล้ว';
    page.startCreate();
    expect(page.feedback).toBe('');
    page.feedback = 'บันทึกออเดอร์แล้ว';
    page.edit({id:7,customerId:3,boxes:1,status:'CANCELLED',orderDate:'2026-09-30',isSimulated:false});
    expect(page.feedback).toBe('');
  });
});
