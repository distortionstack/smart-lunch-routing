import { fromBackendStatus, mapCustomer, mapOrder, mapRider, toBackendStatus, todayLocal } from './backend-api.service';

describe('backend-api mapping', () => {
  it('maps a backend customer to the local model', () => {
    expect(
      mapCustomer({ id: 7, name: 'สมชาย ใจดี', phone: '0812345678', address: null, lat: 16.2469, lng: 103.2531 }),
    ).toEqual({ id: '7', name: 'สมชาย ใจดี', phone: '0812345678', address: '', lat: 16.2469, lng: 103.2531 });
  });

  it('maps backend order statuses onto the three local states', () => {
    expect(fromBackendStatus('PENDING')).toBe('pending');
    expect(fromBackendStatus('DELIVERED')).toBe('delivered');
    expect(fromBackendStatus('PLANNED')).toBe('assigned');
    expect(fromBackendStatus('DELIVERING')).toBe('assigned');
    expect(fromBackendStatus('CANCELLED')).toBe('assigned');
    expect(toBackendStatus('pending')).toBe('PENDING');
    expect(toBackendStatus('delivered')).toBe('DELIVERED');
    expect(toBackendStatus('assigned')).toBe('PLANNED');
  });

  it('maps a backend order and rider with string ids', () => {
    const order = mapOrder({ id: 3, customerId: 7, boxes: 2, status: 'PENDING', orderDate: '2026-09-30' });
    expect(order).toMatchObject({ id: '3', customerId: '7', boxes: 2, status: 'pending' });

    const rider = mapRider({ id: 2, name: 'Rider Two', phone: null, isAvailable: true }, 1);
    expect(rider).toMatchObject({ id: '2', name: 'Rider Two', phone: '', jobCode: 'LUNCH-2' });
    expect(rider.color).toMatch(/^#/);
  });

  it('builds a local YYYY-MM-DD date', () => {
    expect(todayLocal(new Date(2026, 8, 30))).toBe('2026-09-30');
  });
});
