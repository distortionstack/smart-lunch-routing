import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { catchError, filter, tap, throwError, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

export type User = { type: 'OWNER' | 'RIDER'; id: number; name: string };
type Session = { token: string; user: User };
const SESSION_KEY = 'smart-lunch-session-v1';
const privateKeys = ['smart-lunch-customers-v1', 'smart-lunch-orders-v1', 'smart-lunch-plan-v1'];

function clearPrivateCache(): void {
  try {
    for (const key of privateKeys) localStorage.removeItem(key);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('smart-lunch-route-details-v1:')) localStorage.removeItem(key);
    }
  } catch { /* storage may be unavailable */ }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/auth`;
  private readonly session = signal<Session | null>(this.readSession());
  readonly user = signal<User | null>(this.session()?.user ?? null);

  constructor() { clearPrivateCache(); }

  token(): string | null { return this.session()?.token ?? null; }

  login(role: User['type'], username: string, password: string) {
    return this.http.post<Session>(`${this.url}/login`, { role, username, password }).pipe(tap(session => {
      clearPrivateCache();
      this.session.set(session);
      this.user.set(session.user);
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* current tab still works */ }
    }));
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.put<void>(`${this.url}/password`, { currentPassword, newPassword });
  }

  logout(): void {
    const token = this.token();
    if (token) this.http.post(`${this.url}/logout`, {}).subscribe({ error: () => { /* local logout remains effective */ } });
    this.clear();
  }

  clear(): void {
    this.session.set(null);
    this.user.set(null);
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
    clearPrivateCache();
  }

  private readSession(): Session | null {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as Session | null;
      return parsed?.token && (parsed.user?.type === 'OWNER' || parsed.user?.type === 'RIDER') ? parsed : null;
    } catch { return null; }
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const apiRequest = req.url.startsWith(`${environment.apiBaseUrl}/`);
  return next(apiRequest && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req).pipe(
    timeout(apiRequest && /\/route-plans\/(generate|recalculate)$/.test(req.url) ? 30000 : 15000),
    filter(() => !apiRequest || token === null || token === auth.token()),
    catchError(error => {
      if (apiRequest && token === auth.token() && error.status === 401 && !req.url.endsWith('/auth/login') && !req.url.endsWith('/auth/password')) {
        auth.clear();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};

export function roleGuard(role: User['type']): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.user()?.type === role ? true : router.createUrlTree(['/login']);
  };
}
