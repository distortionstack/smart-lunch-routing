import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, timeout } from 'rxjs';
import { apiErrorMessage } from '../../core/api-error';
import { FormsModule } from '@angular/forms';
import { DeliveryMapComponent } from '../../shared/delivery-map/delivery-map.component';
import { ShopSettings, ShopSettingsApiService } from '../../core/shop-settings-api.service';
import { DeliveryService } from '../../core/delivery.service';
import { RoutePlanApiService } from '../../core/route-plan-api.service';

@Component({
  selector: 'app-settings', standalone: true, imports: [FormsModule, DeliveryMapComponent],
  template: `<section class="mx-auto max-w-3xl p-4 sm:p-8"><div class="neu-panel rounded-2xl p-5 sm:p-8">
    <h1 class="text-2xl font-bold">ตั้งค่าร้าน</h1><p class="mt-2 text-sm text-slate-600">การเปลี่ยนค่าเส้นทางและต้นทุนมีผลกับแผนที่คำนวณใหม่ กรุณาคำนวณแผนร่างใหม่ก่อนยืนยัน</p>
    @if (loading) { <p class="mt-5">กำลังโหลด...</p> }
    @if (error) { <p class="mt-5 rounded-xl bg-red-50 p-3 text-red-900" role="alert">{{ error }}</p> }
    @if (saved) { <p class="mt-5 rounded-xl bg-emerald-50 p-3 text-emerald-900" role="status">บันทึกแล้ว กรุณาคำนวณแผนร่างใหม่</p> }
    @if (draft; as s) { <form #settingsForm="ngForm" class="mt-6 grid gap-5" (ngSubmit)="settingsForm.valid && save()">
      <label class="grid gap-1 font-semibold">ชื่อร้าน<input class="neu-field min-h-12 rounded-xl px-3" name="shopName" [(ngModel)]="s.shopName" required maxlength="150" /></label>
      <fieldset class="grid gap-3 sm:grid-cols-2"><legend class="mb-2 font-bold">ตำแหน่งร้าน</legend>
        <p class="text-sm text-slate-600 sm:col-span-2">ลากหมุดหรือคลิกบนแผนที่ตรงที่ตั้งร้าน แล้วกดบันทึกค่าร้านด้านล่าง</p>
        <div class="h-[360px] overflow-hidden rounded-xl border border-line sm:col-span-2" aria-label="เลือกที่ตั้งร้าน">
          <app-delivery-map [pickable]="true" [showShop]="false" [selectedLocation]="{lat:s.latitude,lng:s.longitude}" (locationPicked)="setLocation($event)" />
        </div>
        <details class="rounded-xl border border-line p-3 sm:col-span-2"><summary class="cursor-pointer font-semibold">แก้พิกัดตัวเลขโดยตรง</summary><div class="mt-3 grid gap-3 sm:grid-cols-2">
        <label class="grid gap-1">ละติจูด<input class="neu-field min-h-12 rounded-xl px-3" name="latitude" type="number" step="any" min="-90" max="90" [(ngModel)]="s.latitude" required /></label>
        <label class="grid gap-1">ลองจิจูด<input class="neu-field min-h-12 rounded-xl px-3" name="longitude" type="number" step="any" min="-180" max="180" [(ngModel)]="s.longitude" required /></label></div></details></fieldset>
      <fieldset class="grid gap-3 sm:grid-cols-2"><legend class="mb-2 font-bold">รอบส่ง</legend>
        <label class="grid gap-1">เริ่มส่ง<input class="neu-field min-h-12 rounded-xl px-3" name="deliveryStartTime" type="time" [(ngModel)]="s.deliveryStartTime" required /></label>
        <label class="grid gap-1">ส่งให้เสร็จก่อน<input class="neu-field min-h-12 rounded-xl px-3" name="deliveryDeadline" type="time" [(ngModel)]="s.deliveryDeadline" required /></label>
        <label class="grid gap-1 sm:col-span-2">ออเดอร์สูงสุดต่อไรเดอร์<input class="neu-field min-h-12 rounded-xl px-3" name="maxOrdersPerRider" type="number" min="1" max="3" [(ngModel)]="s.maxOrdersPerRider" required /></label></fieldset>
      <details class="rounded-xl border border-line p-4"><summary class="cursor-pointer font-bold">ค่าคำนวณต้นทุนและเวลา</summary><div class="mt-4 grid gap-3 sm:grid-cols-2">
        <label class="grid gap-1">ราคาขายต่อกล่อง<input class="neu-field min-h-12 rounded-xl px-3" name="boxSalePrice" type="number" min="0" step="0.01" [(ngModel)]="s.boxSalePrice" /></label>
        <label class="grid gap-1">ต้นทุนอาหารต่อกล่อง<input class="neu-field min-h-12 rounded-xl px-3" name="boxFoodCost" type="number" min="0" step="0.01" [(ngModel)]="s.boxFoodCost" /></label>
        <label class="grid gap-1">ค่าไรเดอร์พื้นฐาน<input class="neu-field min-h-12 rounded-xl px-3" name="riderBaseCost" type="number" min="0" step="0.01" [(ngModel)]="s.riderBaseCost" /></label>
        <label class="grid gap-1">ค่าไรเดอร์ต่อกิโลเมตร<input class="neu-field min-h-12 rounded-xl px-3" name="riderCostPerKm" type="number" min="0" step="0.01" [(ngModel)]="s.riderCostPerKm" /></label>
        <label class="grid gap-1 sm:col-span-2">เวลาส่งของต่อจุด (นาที)<input class="neu-field min-h-12 rounded-xl px-3" name="stopServiceMinutes" type="number" min="0" max="30" step="1" [(ngModel)]="s.stopServiceMinutes" /></label><label class="grid gap-1 sm:col-span-2">ความเร็วเฉลี่ยไรเดอร์ (กม./ชม.)<input class="neu-field min-h-12 rounded-xl px-3" name="riderSpeedKmh" type="number" min="1" max="120" step="0.1" [(ngModel)]="s.riderSpeedKmh" /></label>
      </div></details>
      <button class="neu-primary min-h-12 rounded-xl px-5 font-bold" type="submit" [disabled]="saving || settingsForm.invalid">{{ saving ? 'กำลังบันทึก...' : 'บันทึกค่าร้าน' }}</button>
    </form> }
  </div></section>`,
})
export class SettingsComponent implements OnInit {
  private readonly api = inject(ShopSettingsApiService);
  private readonly store = inject(DeliveryService);
  private readonly plans = inject(RoutePlanApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  draft: ShopSettings | null = null;
  loading = true;
  saving = false;
  saved = false;
  error = '';
  setLocation(location: {lat:number;lng:number}): void {
    if (!this.draft || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat)>90 || Math.abs(location.lng)>180) return;
    this.draft = {...this.draft, latitude:location.lat, longitude:location.lng};
    this.saved = false;
    this.cdr.markForCheck();
  }
  ngOnInit(): void {
    this.api.get().pipe(timeout(15000), takeUntilDestroyed(this.destroyRef), finalize(() => { this.loading = false; this.cdr.markForCheck(); })).subscribe({ next: settings => { this.draft = { ...settings, deliveryStartTime: settings.deliveryStartTime.slice(0, 5), deliveryDeadline: settings.deliveryDeadline.slice(0, 5) }; }, error: error => { this.error = apiErrorMessage(error, 'โหลดค่าร้านไม่สำเร็จ'); } });
  }
  save(): void {
    if (!this.draft || this.saving) return;
    this.error = ''; this.saved = false;
    if (!Number.isFinite(this.draft.latitude) || !Number.isFinite(this.draft.longitude) || Math.abs(this.draft.latitude)>90 || Math.abs(this.draft.longitude)>180) { this.error='เลือกตำแหน่งร้านที่ถูกต้องบนแผนที่'; return; }
    if (!this.draft.shopName.trim() || this.draft.deliveryStartTime >= this.draft.deliveryDeadline) { this.error = 'ตรวจสอบชื่อร้านและเวลาส่ง'; return; }
    this.saving = true;
    const { settingId: _settingId, ...patch } = this.draft;
    this.api.update(patch).pipe(timeout(15000), takeUntilDestroyed(this.destroyRef), finalize(() => { this.saving = false; this.cdr.markForCheck(); })).subscribe({ next: settings => { this.draft = { ...settings, deliveryStartTime: settings.deliveryStartTime.slice(0, 5), deliveryDeadline: settings.deliveryDeadline.slice(0, 5) }; this.store.settings.set(settings); this.plans.invalidateCache(); this.saved = true; }, error: error => { this.error = apiErrorMessage(error, 'บันทึกค่าร้านไม่สำเร็จ กรุณาตรวจสอบข้อมูล'); } });
  }
}
