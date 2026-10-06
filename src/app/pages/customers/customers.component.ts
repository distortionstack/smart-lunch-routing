import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../core/api-error';
import { FormsModule } from '@angular/forms';
import { Customer, SHOP } from '../../core/models';
import { CustomersApiService } from '../../core/customer-api.service';
import { DeliveryService } from '../../core/delivery.service';
import { DeliveryMapComponent } from '../../shared/delivery-map/delivery-map.component';
import { NearbySearchComponent } from '../../shared/nearby-search.component';
import { finalize, timeout } from 'rxjs';

type Draft = Omit<Customer, 'id'> & { id?: string };

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [FormsModule, DeliveryMapComponent, NearbySearchComponent],
  templateUrl: './customers.component.html',
})
export class CustomersComponent implements OnInit {
  private readonly customerApi = inject(CustomersApiService);
  readonly deliveryStore = inject(DeliveryService);
  private readonly destroyRef = inject(DestroyRef);
  // รายชื่อ customers for show (from backend)
  readonly apiCustomers = signal<Customer[]>([]);

  // Status Load API
  readonly loadingCustomers = signal(true);
  readonly loadCustomersError = signal('');

  // สถานะบันทึก
  readonly savingCustomer = signal(false);

  // null = ไม่ได้กำลังลบ / string = id ของลูกค้าที่กำลังลบ
  readonly deletingCustomerId = signal<string | null>(null);

  query = '';
  nearbyPoint = false;
  nearbyRadius = 1;
  readonly distances = signal<Record<string,number>>({});
  private loadRequestId = 0;
  searchNearby(radius=this.nearbyRadius): void { this.nearbyRadius=radius; this.nearbyPoint = true; this.loadCustomers(); }
  clearNearby(): void { this.nearbyPoint = false; this.loadCustomers(); }
  placeQuery = '';
  showOverviewMap = false;
  showForm = false;
  showCoordinates = false;
  locationSelected = false;
  pickerLocation: { lat: number; lng: number } | null = null;
  manualLat: number | null = null;
  manualLng: number | null = null;
  error = '';
  feedback = '';
  draft: Draft = this.blankDraft();
  mapShop() { const settings = this.deliveryStore.settings?.(); return settings ? { lat: settings.latitude, lng: settings.longitude, name: settings.shopName } : SHOP; }
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.loadCustomers();
    this.destroyRef.onDestroy(() => clearTimeout(this.feedbackTimer));
  }

  // ใช้ทั้งตอนเปิดหน้าและตอนกดค้นหา
  loadCustomers(): void {    this.loadingCustomers.set(true);
    this.loadCustomersError.set('');

    const requestId = ++this.loadRequestId;
    const point = this.nearbyPoint;
    const request = point ? this.customerApi.nearby(this.nearbyRadius) : this.customerApi.getCustomers(this.query);
    request.pipe(timeout(15000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (customers) => {
        if (requestId !== this.loadRequestId) return;
        this.distances.set(Object.fromEntries(customers.filter(customer => customer.distanceKm !== undefined).map(customer => [String(customer.id),customer.distanceKm!])));
        this.apiCustomers.set(
          customers.map((customer) => ({
            id: String(customer.id),
            name: customer.name,
            phone: customer.phone,
            address: customer.address ?? '',
            lat: customer.lat,
            lng: customer.lng,
          })),
        );

        this.loadingCustomers.set(false);
      },
      error: (error) => {
        if (requestId !== this.loadRequestId) return;
        console.error('โหลดลูกค้าจาก API ไม่สำเร็จ:', error);

        this.loadCustomersError.set('โหลดรายชื่อลูกค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        this.loadingCustomers.set(false);
      },
    });
  }

  filteredCustomers(): Customer[] {
    // backend ค้นให้แล้ว แสดงรายการที่ตอบกลับได้เลย
    const term = this.query.trim().toLowerCase();
    return this.nearbyPoint ? this.apiCustomers().filter(customer => `${customer.name} ${customer.phone} ${customer.address}`.toLowerCase().includes(term)) : this.apiCustomers();
  }

  private searchTimer?: ReturnType<typeof setTimeout>;

  // ค้นหาแบบ live ขณะพิมพ์ (debounce) ให้เหมือนหน้าออเดอร์
  onQueryChange(): void {
    clearTimeout(this.searchTimer);
    if (this.loadingCustomers() || this.savingCustomer() || this.deletingCustomerId() !== null) return;
    this.searchTimer = setTimeout(() => this.loadCustomers(), 400);
  }

  // เลือกตำแหน่งจากลูกค้าที่โหลดมาแล้ว
  placeMatches(): Customer[] {
    const term = this.placeQuery.trim().toLowerCase();

    return term
      ? this.apiCustomers()
          .filter((customer) => `${customer.name} ${customer.address}`.toLowerCase().includes(term))
          .slice(0, 5)
      : [];
  }

  startCreate(): void {
    // กันเปลี่ยนไปเปิดฟอร์มอื่นระหว่างบันทึก และ ลบ
    if (this.savingCustomer() || this.deletingCustomerId() !== null) return;

    this.draft = this.blankDraft();
    this.locationSelected = false;
    this.pickerLocation = null;
    this.manualLat = null;
    this.manualLng = null;
    this.placeQuery = '';
    this.showCoordinates = false;
    this.error = '';
    this.showForm = true;
  }

  edit(customer: Customer): void {
    // กันเปลี่ยนไปเปิดฟอร์มอื่นระหว่างบันทึก และ ลบ
    if (this.savingCustomer() || this.deletingCustomerId() !== null) return;

    this.draft = { ...customer };
    this.locationSelected = true;
    this.pickerLocation = { lat: customer.lat, lng: customer.lng };
    this.manualLat = customer.lat;
    this.manualLng = customer.lng;
    this.placeQuery = '';
    this.showCoordinates = false;
    this.error = '';
    this.showForm = true;
  }

  cancel(): void {
    // กันเปลี่ยนไปเปิดฟอร์มอื่นระหว่างบันทึก และ ลบ
    if (this.savingCustomer() || this.deletingCustomerId() !== null) return;

    this.showForm = false;
    this.error = '';
  }

  selectPlace(customer: Customer): void {
    this.setLocation({ lat: customer.lat, lng: customer.lng });
    if (!this.draft.address.trim()) this.draft.address = customer.address;
    this.placeQuery = '';
  }

  setLocation(location: { lat: number; lng: number }): void {
    this.draft.lat = location.lat;
    this.draft.lng = location.lng;
    this.locationSelected = true;
    this.pickerLocation = location;
    this.manualLat = location.lat;
    this.manualLng = location.lng;
    this.error = '';
  }

  clearLocation(): void {
    this.locationSelected = false;
    this.pickerLocation = null;
  }

  applyCoordinates(): void {
    if (
      this.manualLat === null ||
      this.manualLng === null ||
      !Number.isFinite(this.manualLat) ||
      !Number.isFinite(this.manualLng) ||
      Math.abs(this.manualLat) > 90 ||
      Math.abs(this.manualLng) > 180
    ) {
      this.error = 'กรุณาตรวจสอบตำแหน่งจัดส่งอีกครั้ง';
      return;
    }
    this.setLocation({ lat: this.manualLat, lng: this.manualLng });
  }

  save(): void {
    // กันเปลี่ยนไปเปิดฟอร์มอื่นระหว่างบันทึก และ ลบ ไม่เกิดขึ้นพร้อมกัน
    if (this.savingCustomer() || this.deletingCustomerId() !== null) return;

    this.error = '';

    if (!this.locationSelected) {
      this.error = 'กรุณาปักตำแหน่งจัดส่งของลูกค้า';
      return;
    }

    // หยิบข้อมูลจากฟอร์มเป็นข้อมูลที่จะส่ง โดยไม่ส่ง id
    const input = {
      name: this.draft.name.trim(),
      phone: this.draft.phone.trim(),
      address: this.draft.address.trim() || null,
      lat: this.draft.lat,
      lng: this.draft.lng,
    };

    this.savingCustomer.set(true);

    // เก็บ id ของรายการที่กำลังแก้ไขไว้ก่อนส่งคำขอ
    const editingId = this.draft.id;

    // มี id = แก้คนเดิมด้วย PUT / ไม่มี id = เพิ่มคนใหม่ด้วย POST
    const request = editingId
      ? this.customerApi.updateCustomer(editingId, input)
      : this.customerApi.createCustomer(input);

    request.pipe(timeout(15000), takeUntilDestroyed(this.destroyRef), finalize(() => this.savingCustomer.set(false))).subscribe({
      next: () => {
        this.savingCustomer.set(false);
        this.cancel();
        this.notify(editingId ? 'บันทึกการแก้ไขลูกค้าแล้ว' : 'เพิ่มลูกค้าใหม่แล้ว');
        this.deliveryStore.refresh();

        // โหลดจาก backend ใหม่ เพื่อให้รายการตรงกับคำค้นและลำดับล่าสุด
        this.loadCustomers();
      },
      error: (error) => {
        console.error('บันทึกลูกค้าไม่สำเร็จ:', error);
        this.savingCustomer.set(false);

        if (error?.name === 'TimeoutError') { this.error = apiErrorMessage(error, 'หมดเวลารอระบบ'); return; }
        // คงฟอร์มและข้อมูลที่กรอกไว้ ให้แก้หรือลองใหม่ได้
        // แสดงเหตุผลตามสถานะที่ backend ตอบกลับ
        if (error.status === 400) {
          this.error = 'ข้อมูลไม่ถูกต้อง กรุณาตรวจชื่อ เบอร์โทร และพิกัด';
        } else if (error.status === 409) {
          this.error = apiErrorMessage(error, 'ข้อมูลขัดแย้ง กรุณารีเฟรชรายการ');
        } else if (error.status === 404) {
          this.error = 'ไม่พบลูกค้ารายนี้แล้ว กรุณารีเฟรชรายการ';
        } else if (error.status === 0) {
          this.error = 'ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ';
        } else {
          this.error = 'เซิร์ฟเวอร์บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
        }
      },
    });
  }

  // REMOVE //
  remove(customer: Customer): void {
    // ไม่ให้ลบซ้ำ หรือลบระหว่างบันทึกฟอร์ม
    if (this.savingCustomer() || this.deletingCustomerId() !== null) return;

    if (!window.confirm(`ลบข้อมูลของ ${customer.name} หรือไม่?`)) return;

    this.deletingCustomerId.set(customer.id);

    this.customerApi.deleteCustomer(customer.id).pipe(timeout(15000), takeUntilDestroyed(this.destroyRef), finalize(() => this.deletingCustomerId.set(null))).subscribe({
      next: () => {
        this.deletingCustomerId.set(null);
        this.deliveryStore.customerDeleted(customer.id);

        // backend ลบสำเร็จแล้ว จึงเอารายการออกจากหน้าจอ
        this.apiCustomers.update((customers) =>
          customers.filter((item) => item.id !== customer.id),
        );

        // ถ้าเปิดฟอร์มของคนที่ถูกลบอยู่ ให้ปิดฟอร์มด้วย
        if (this.draft.id === customer.id) this.cancel();

        this.notify(`ลบข้อมูลของ ${customer.name} แล้ว`);
      },
      error: (error) => {
        this.deletingCustomerId.set(null);
        if (error?.name === 'TimeoutError') { this.notify(apiErrorMessage(error, 'หมดเวลารอระบบ')); return; }

        if (error.status === 409) {
          this.notify('ลบไม่ได้ เพราะลูกค้ารายนี้มีออเดอร์อ้างอิงอยู่');
        } else if (error.status === 404) {
          this.notify('ไม่พบลูกค้ารายนี้แล้ว กรุณารีเฟรชรายการ');
        } else {
          this.notify('ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        }
      },
    });
  }

  private notify(message: string): void {
    clearTimeout(this.feedbackTimer);
    this.feedback = message;
    this.feedbackTimer = setTimeout(() => (this.feedback = ''), 3500);
  }

  private blankDraft(): Draft {
    return { name: '', phone: '', address: '', lat: 16.24631, lng: 103.25286 };
  }
}
