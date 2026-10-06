import { Component, effect, inject, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DeliveryService } from './core/delivery.service';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly store = inject(DeliveryService);

  constructor() {
    effect(() => {
      const role = this.auth.user()?.type;
      untracked(() => {
        this.store.clearForLogout();
        if (role === 'OWNER') this.store.connect();
      });
    });
  }

  logout(): void { this.auth.logout(); void this.router.navigateByUrl('/login'); }

  pageTitle(): string {
    if (this.router.url.includes('/customers')) return 'ข้อมูลลูกค้า';
    if (this.router.url.includes('/orders')) return 'ออเดอร์วันนี้';
    if (this.router.url.includes('/riders')) return 'จัดการไรเดอร์';
    if (this.router.url.includes('/settings')) return 'ตั้งค่าร้าน';
    return 'ศูนย์จัดส่งวันนี้';
  }
}
