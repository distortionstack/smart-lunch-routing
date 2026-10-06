import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiCustomer, CustomersApiService } from './customer-api.service';
import { HttpErrorResponse } from '@angular/common/http';

// describe
// ├── beforeEach
// ├── afterEach
// ├── it GET
// └── it POST
describe('CustomersApiService', () => {
  let service: CustomersApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        // วางหลัง provideHttpClient เพื่อแทนการส่ง HTTP จริง
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CustomersApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // ตรวจว่าไม่มีคำขอที่ test ลืมจัดการ
    http.verify();
  });

  //   ==================================================================
  //   GET
  it('searches customers with GET and returns the response', () => {
    const response: ApiCustomer[] = [
      {
        id: 1,
        name: 'ลูกค้าทดสอบ',
        phone: '0800000000',
        address: null,
        lat: 16.2469,
        lng: 103.2531,
      },
    ];

    let received: ApiCustomer[] | undefined;

    // เรียก service เหมือนที่หน้าลูกค้าเรียก
    service.getCustomers('  ลูกค้าทดสอบ  ').subscribe((customers) => {
      received = customers;
    });

    // ดักคำขอไว้ ไม่ส่งออกไป backend จริง
    const request = http.expectOne((req) => req.url === '/api/customers');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('search')).toBe('ลูกค้าทดสอบ');

    // จำลองว่า backend ตอบรายการนี้กลับมา
    request.flush(response);

    expect(received).toEqual(response);
  });

  //  ============================================================= //
  //   POST
  // ตรวจว่า ส่ง POST พร้อมข้อมูลฟอร์มโดยไม่มี ID แล้วรับลูกค้าพร้อม ID กลับได้, ส่วน 201 คือสถานะที่ backend ตอบเมื่อสร้างสำเร็จ ทั้งหมดเป็นข้อมูลจำลอง
  it('creates a customer with POST and returns the assigned id', () => {
    // ข้อมูลจากฟอร์ม ยังไม่มี id
    const input = {
      name: 'ลูกค้าทดสอบ',
      phone: '0800000000',
      address: null,
      lat: 16.2469,
      lng: 103.2531,
    };

    // จำลองคำตอบหลังฐานข้อมูลสร้าง id ให้
    const response: ApiCustomer = {
      ...input,
      id: 42,
    };

    let received: ApiCustomer | undefined;

    service.createCustomer(input).subscribe((customer) => {
      received = customer;
    });

    const request = http.expectOne('/api/customers');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    expect(request.request.body).not.toHaveProperty('id');

    request.flush(response, {
      status: 201,
      statusText: 'Created',
    });

    expect(received).toEqual(response);
  });

  //   ========================================================== //
  //   PUT
  // ยืนยันว่า frontend ส่งคำขอถูกต้อง ไม่ได้ทดสอบ SQL หรือเขียนลง TiDB
  it('updates the selected customer with PUT and preserves a null address', () => {
    const input = {
      name: 'ชื่อที่แก้ไข',
      phone: '0800000000',
      address: null,
      lat: 16.2469,
      lng: 103.2531,
    };

    const response: ApiCustomer = {
      ...input,
      id: 42,
    };

    let received: ApiCustomer | undefined;

    service.updateCustomer('42', input).subscribe((customer) => {
      received = customer;
    });

    // ต้องส่งไปยังลูกค้า 42 ไม่ใช่ URL สร้างลูกค้าใหม่
    const request = http.expectOne('/api/customers/42');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(input);
    expect(request.request.body.address).toBeNull();

    request.flush(response);

    expect(received).toEqual(response);
  });

  //  ================================================================ //
  // DELETE
  // complete ทำงานเมื่อคำขอจบสำเร็จ ส่วน URL ที่มี 42 ยืนยันว่าเราขอลบลูกค้าคนที่เลือก
  it('deletes the selected customer and accepts a 204 response', () => {
    let completed = false;

    service.deleteCustomer('42').subscribe({
      complete: () => {
        completed = true;
      },
    });

    const request = http.expectOne('/api/customers/42');

    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();

    // จำลองการลบสำเร็จ โดยไม่มีข้อมูลตอบกลับ
    request.flush(null, {
      status: 204,
      statusText: 'No Content',
    });

    expect(completed).toBe(true);
  });

  //   =============================================================== //
  // ERROR
  //   HTTP จำลองตอบ 409 → API service → เข้า error ของผู้เรียก
  it('passes a delete conflict to the caller without reporting success', () => {
    let receivedError: HttpErrorResponse | undefined;
    let succeeded = false;

    service.deleteCustomer('42').subscribe({
      next: () => {
        succeeded = true;
      },
      error: (error: HttpErrorResponse) => {
        receivedError = error;
      },
    });

    const request = http.expectOne('/api/customers/42');

    // จำลองว่าฐานข้อมูลไม่ยอมให้ลบ เพราะมีออเดอร์อ้างอิง
    request.flush(
      { message: 'Cannot delete customer with existing orders' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(succeeded).toBe(false);
    expect(receivedError?.status).toBe(409);
    expect(receivedError?.error.message).toBe('Cannot delete customer with existing orders');
  });
});
