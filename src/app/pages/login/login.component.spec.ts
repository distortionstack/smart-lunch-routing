import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  it('submits owner credentials and shows a failed login', async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [LoginComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const login = fixture.componentInstance;
    login.role = 'OWNER'; login.username = 'sample-owner'; login.password = 'long test password';
    login.login();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/auth/login');
    expect(request.request.body).toEqual({ role: 'OWNER', username: 'sample-owner', password: 'long test password' });
    request.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('เข้าสู่ระบบไม่สำเร็จ');
  });
});
