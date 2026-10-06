import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, timeout } from 'rxjs';
import { apiErrorMessage } from '../../core/api-error';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, type User } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `<section class="min-h-dvh bg-neu px-4 py-12"><div class="neu-panel mx-auto max-w-md rounded-2xl p-6 sm:p-8">
    <h1 class="text-2xl font-bold">เข้าสู่ระบบ</h1><p class="mt-2 text-sm text-slate-600">เข้าสู่ระบบเพื่อดูงานและข้อมูลตามหน้าที่</p>
    <form class="mt-6 grid gap-4" (ngSubmit)="login()">
      <label class="grid gap-1 text-sm font-semibold">ประเภทบัญชี<select class="neu-field min-h-12 rounded-xl px-3" name="role" [(ngModel)]="role"><option value="OWNER">เจ้าของร้าน</option><option value="RIDER">ไรเดอร์</option></select></label>
      <label class="grid gap-1 text-sm font-semibold">ชื่อผู้ใช้<input class="neu-field min-h-12 rounded-xl px-3" name="username" [(ngModel)]="username" required autocomplete="username" [placeholder]="role === 'RIDER' ? 'เช่น rider_1' : ''" /></label>
      <label class="grid gap-1 text-sm font-semibold">รหัสผ่าน<input class="neu-field min-h-12 rounded-xl px-3" name="password" [(ngModel)]="password" required type="password" autocomplete="current-password" /></label>
      @if (error) { <p class="rounded-xl bg-red-50 p-3 text-sm text-red-900" role="alert">{{ error }}</p> }
      <button class="neu-primary min-h-12 rounded-xl font-bold" [disabled]="loading" type="submit">{{ loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}</button>
    </form></div></section>`,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  role: User['type'] = 'RIDER';
  username = '';
  password = '';
  error = '';
  loading = false;
  login(): void {
    if (!this.username.trim() || !this.password || this.loading) return;
    this.loading = true;
    this.error = '';
    this.auth.login(this.role, this.username.trim(), this.password).pipe(timeout(15000), takeUntilDestroyed(this.destroyRef), finalize(() => { this.loading = false; this.cdr.markForCheck(); })).subscribe({
      next: ({ user }) => { this.password = ''; void this.router.navigateByUrl(user.type === 'OWNER' ? '/owner/delivery' : '/rider'); },
      error: error => { this.error = error?.status === 401 ? 'เข้าสู่ระบบไม่สำเร็จ ตรวจสอบข้อมูลและลองใหม่' : apiErrorMessage(error, 'เข้าสู่ระบบไม่สำเร็จ ตรวจสอบข้อมูลและลองใหม่'); },
    });
  }
}
