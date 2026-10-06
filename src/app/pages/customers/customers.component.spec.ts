import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ApiCustomer, CustomersApiService } from '../../core/customer-api.service';
import { CustomersComponent } from './customers.component';

describe('CustomersComponent', () => {
  //  ====================================== //
  it('shows loading, then an error instead of an empty list', async () => {
    // ควบคุมว่า API จะตอบเมื่อไร โดยไม่เรียก backend จริง
    const response = new Subject<ApiCustomer[]>();
    const api = {
      getCustomers: vi.fn().mockReturnValue(response),
    };

    await TestBed.configureTestingModule({
      imports: [CustomersComponent],
      providers: [{ provide: CustomersApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomersComponent);

    // เริ่มแสดงหน้า และเรียก ngOnInit()
    fixture.detectChanges();

    const page: HTMLElement = fixture.nativeElement;

    expect(page.textContent).toContain('กำลังโหลดรายชื่อลูกค้า');
    expect(page.textContent).not.toContain('ยังไม่มีข้อมูลลูกค้า');

    // จำลอง API ตอบ error และซ่อน log ที่เราตั้งใจทดสอบ
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      response.error(new Error('Connection failed'));
      fixture.detectChanges();

      expect(page.querySelector('[role="alert"]')?.textContent).toContain(
        'โหลดรายชื่อลูกค้าไม่สำเร็จ',
      );

      expect(page.textContent).not.toContain('กำลังโหลดรายชื่อลูกค้า');
      expect(page.textContent).not.toContain('ยังไม่มีข้อมูลลูกค้า');
    } finally {
      errorLog.mockRestore();
    }
  });

  //   =================================================== //
  it('shows an empty state when the API successfully returns no customers', async () => {
    const response = new Subject<ApiCustomer[]>();
    const api = {
      getCustomers: vi.fn().mockReturnValue(response),
    };

    await TestBed.configureTestingModule({
      imports: [CustomersComponent],
      providers: [{ provide: CustomersApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomersComponent);
    fixture.detectChanges();

    // API สำเร็จ แต่ไม่มีรายการลูกค้า
    response.next([]);
    response.complete();
    fixture.detectChanges();

    const page: HTMLElement = fixture.nativeElement;

    expect(page.textContent).toContain('ยังไม่มีข้อมูลลูกค้า');
    expect(page.textContent).not.toContain('กำลังโหลดรายชื่อลูกค้า');
    expect(page.querySelector('[role="alert"]')).toBeNull();
  });

  // ==================================================== //
  // การโหลดรายการ
  it('displays customers returned by the API', async () => {
    const response = new Subject<ApiCustomer[]>();
    const api = {
      getCustomers: vi.fn().mockReturnValue(response),
    };

    await TestBed.configureTestingModule({
      imports: [CustomersComponent],
      providers: [{ provide: CustomersApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomersComponent);
    fixture.detectChanges();

    response.next([
      {
        id: 42,
        name: 'ลูกค้าจาก API',
        phone: '0800000000',
        address: null,
        lat: 16.2469,
        lng: 103.2531,
      },
    ]);
    response.complete();
    fixture.detectChanges();

    const page: HTMLElement = fixture.nativeElement;

    expect(page.textContent).toContain('ลูกค้าจาก API');
    expect(page.textContent).toContain('0800000000');
    expect(page.textContent).toContain('ยังไม่มีรายละเอียดที่อยู่');
    expect(page.textContent).not.toContain('ยังไม่มีข้อมูลลูกค้า');
    expect(page.textContent).not.toContain('กำลังโหลดรายชื่อลูกค้า');
    expect(page.querySelector('[role="alert"]')).toBeNull();
  });

  // ===================================================== //
  // เริ่มจากคลิกปุ่มใน HTML แล้วตรวจสิ่งที่ผู้ใช้เห็น ทั้งสถานะ “กำลังลบ” และการเก็บรายการไว้เมื่อเกิด error โดยยังใช้ API จำลอง
  it('keeps the customer visible when deletion returns 409', async () => {
    const listResponse = new Subject<ApiCustomer[]>();
    const deleteResponse = new Subject<void>();

    const api = {
      getCustomers: vi.fn().mockReturnValue(listResponse),
      deleteCustomer: vi.fn().mockReturnValue(deleteResponse),
    };

    await TestBed.configureTestingModule({
      imports: [CustomersComponent],
      providers: [{ provide: CustomersApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomersComponent);
    fixture.detectChanges();

    // เตรียมลูกค้าหนึ่งคนบนหน้าจอ
    listResponse.next([
      {
        id: 42,
        name: 'ลูกค้าที่มีออเดอร์',
        phone: '0800000000',
        address: null,
        lat: 16.2469,
        lng: 103.2531,
      },
    ]);
    listResponse.complete();
    fixture.detectChanges();

    const page: HTMLElement = fixture.nativeElement;

    // จำลองการกดยืนยัน โดยไม่เปิดกล่อง confirm จริง
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    // ควบคุม timer ของข้อความแจ้งเตือนใน test นี้
    vi.useFakeTimers();

    try {
      const deleteButton = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === 'ลบ',
      );

      expect(deleteButton).toBeDefined();
      deleteButton!.click();
      fixture.detectChanges();

      expect(api.deleteCustomer).toHaveBeenCalledWith('42');
      expect(deleteButton!.disabled).toBe(true);
      expect(deleteButton!.textContent).toContain('กำลังลบ');

      // backend ปฏิเสธ เพราะมีออเดอร์อ้างอิง
      deleteResponse.error({ status: 409 });
      fixture.detectChanges();

      expect(page.textContent).toContain('ลูกค้าที่มีออเดอร์');
      expect(page.textContent).toContain('ลบไม่ได้ เพราะลูกค้ารายนี้มีออเดอร์อ้างอิงอยู่');
      expect(deleteButton!.disabled).toBe(false);
    } finally {
      confirm.mockRestore();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  // ============================================================== //
  // ผู้ใช้ไม่ยืนยัน จึงต้องหยุดก่อนส่งคำขอ
  it('does not call the delete API when confirmation is cancelled', async () => {
    const listResponse = new Subject<ApiCustomer[]>();

    const api = {
      getCustomers: vi.fn().mockReturnValue(listResponse),
      deleteCustomer: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CustomersComponent],
      providers: [{ provide: CustomersApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomersComponent);
    fixture.detectChanges();

    listResponse.next([
      {
        id: 42,
        name: 'ลูกค้าที่ต้องเก็บไว้',
        phone: '0800000000',
        address: null,
        lat: 16.2469,
        lng: 103.2531,
      },
    ]);
    listResponse.complete();
    fixture.detectChanges();

    const page: HTMLElement = fixture.nativeElement;

    // false หมายถึงผู้ใช้กดยกเลิก
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    try {
      const deleteButton = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === 'ลบ',
      );

      expect(deleteButton).toBeDefined();
      deleteButton!.click();
      fixture.detectChanges();

      expect(confirm).toHaveBeenCalled();
      expect(api.deleteCustomer).not.toHaveBeenCalled();
      expect(page.textContent).toContain('ลูกค้าที่ต้องเก็บไว้');
      expect(deleteButton!.disabled).toBe(false);
    } finally {
      confirm.mockRestore();
    }
  });

  // ============================================================== //
  // บันทึกไม่สำเร็จแล้วข้อมูลในฟอร์มต้องยังอยู่
  it('keeps the form data when creating a customer fails', async () => {
    const createResponse = new Subject<ApiCustomer>();

    const api = {
      createCustomer: vi.fn().mockReturnValue(createResponse),
    };

    await TestBed.configureTestingModule({
      imports: [CustomersComponent],
      providers: [{ provide: CustomersApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomersComponent);
    const component = fixture.componentInstance;

    // ไม่เรียก detectChanges(): test นี้ตรวจ save() โดยตรง
    // จึงไม่เริ่มโหลดรายการหรือสร้างแผนที่
    component.showForm = true;
    component.locationSelected = true;
    component.draft = {
      name: 'ลูกค้าทดสอบ',
      phone: '0800000000',
      address: 'ที่อยู่ที่กรอกไว้',
      lat: 16.2469,
      lng: 103.2531,
    };

    const originalDraft = { ...component.draft };
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      component.save();

      expect(api.createCustomer).toHaveBeenCalledWith(originalDraft);
      expect(component.savingCustomer()).toBe(true);

      // กดบันทึกซ้ำระหว่างรอ ต้องไม่ส่งคำขอเพิ่ม
      component.save();
      expect(api.createCustomer).toHaveBeenCalledTimes(1);

      // จำลอง backend ปฏิเสธข้อมูล
      createResponse.error({ status: 400 });

      expect(component.savingCustomer()).toBe(false);
      expect(component.showForm).toBe(true);
      expect(component.draft).toEqual(originalDraft);
      expect(component.error).toContain('ข้อมูลไม่ถูกต้อง');
      expect(component.apiCustomers()).toEqual([]);
    } finally {
      errorLog.mockRestore();
    }
  });
});
