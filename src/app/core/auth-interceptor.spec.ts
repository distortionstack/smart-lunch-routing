import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { it, expect, vi } from 'vitest';
import { AuthService, authInterceptor } from './auth.service';

it.each(['old-token', 'new-token', null])('only clears the session that sent a failing request: %s', currentToken => {
  let token: string | null = 'old-token';
  const clear = vi.fn(() => { token = null; });
  const navigateByUrl = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({ providers: [
    provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    { provide: AuthService, useValue: { token: () => token, clear } },
    { provide: Router, useValue: { navigateByUrl } },
  ] });
  TestBed.inject(HttpClient).get('/api/orders').subscribe({ error: () => {} });
  const http = TestBed.inject(HttpTestingController);
  const pending = http.expectOne('/api/orders');
  expect(pending.request.headers.get('Authorization')).toBe('Bearer old-token');
  token = currentToken;
  pending.flush({}, { status: 401, statusText: 'Unauthorized' });
  expect(clear).toHaveBeenCalledTimes(currentToken === 'old-token' ? 1 : 0);
  expect(navigateByUrl).toHaveBeenCalledTimes(currentToken === 'old-token' ? 1 : 0);
  expect(token).toBe(currentToken === 'old-token' ? null : currentToken);
  http.verify();
});

it.each(['new-token', null])('drops a successful response from an old session: %s', currentToken => {
  let token: string | null = 'old-token';
  const next = vi.fn();
  TestBed.configureTestingModule({ providers: [
    provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    { provide: AuthService, useValue: { token: () => token } },
    { provide: Router, useValue: {} },
  ] });
  TestBed.inject(HttpClient).get('/api/orders').subscribe(next);
  const http = TestBed.inject(HttpTestingController);
  const pending = http.expectOne('/api/orders');
  token = currentToken;
  pending.flush([{ id: 1 }]);
  expect(next).not.toHaveBeenCalled();
  http.verify();
});
