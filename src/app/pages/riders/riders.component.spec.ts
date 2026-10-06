import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RidersComponent } from './riders.component';
import { DeliveryService } from '../../core/delivery.service';
import { vi } from 'vitest';

describe('RidersComponent account setup', () => {
  it('sends a username and initial password for a rider without an account', () => {
    TestBed.configureTestingModule({ imports: [RidersComponent], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DeliveryService, useValue: { refresh: vi.fn() } }] });
    const fixture = TestBed.createComponent(RidersComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const rider = { id: 7, name: 'Rider Seven', username: null, hasPassword: false, phone: null, isAvailable: true };
    http.expectOne('/api/riders').flush([rider]);

    const component = fixture.componentInstance;
    component.openAccount(rider);
    component.accountUsername = 'Courier.Seven';
    component.newPassword = 'a long test password';
    component.saveAccount();

    const request = http.expectOne('/api/riders/7/account');
    expect(request.request.body).toEqual({ username: 'courier.seven', password: 'a long test password' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/riders').flush([{ ...rider, username: 'courier.seven', hasPassword: true }]);
    expect(component.riders()[0]?.username).toBe('courier.seven');
    http.verify();
  });
});
