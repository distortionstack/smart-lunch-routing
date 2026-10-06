import { adaptBackendPlan } from './route-plan-adapter';
import type { RoutePlanModel } from './route-plan.models';

it('preserves saved delivery inputs and deadline despite stale lookup data', () => {
  const shop = { settingId: 1, shopName: 'Shop', latitude: 16, longitude: 103,
    deliveryStartTime: '12:00:00', deliveryDeadline: '13:00:00', maxOrdersPerRider: 3,
    riderSpeedKmh: 30, boxSalePrice: 65, boxFoodCost: 40, riderBaseCost: 15, riderCostPerKm: 2 };
  const plan: RoutePlanModel = {
    routePlanId: 1, planDate: '2026-10-05', status: 'SELECTED', shop,startTime:'12:00',deliveryDeadline:'12:40',
    routingSource: 'ROAD', approximate: false, riderCount: 1, totalDistanceKm: 1,
    estimatedFinishTime: '12:45', totalBoxes: 2, totalRevenue: 130, totalFoodCost: 80,
    totalDeliveryCost: 19, estimatedProfit: 31,
    jobs: [{ riderIndex: 0, riderId: 9, totalOrders: 1, totalBoxes: 2, distanceKm: 1,
      durationMinutes: 45, estimatedStartTime: '12:00', estimatedFinishTime: '12:45',
      deliveryCost: 19, geometry: null, approximate: false,
      stops: [{ sequence: 1, orderId: 1, customerId: 1, customerName: 'Saved customer',
        phone: '0812345678', address: 'Saved address', latitude: 16, longitude: 103,
        boxCount: 2, distanceFromPreviousKm: 1, travelTimeFromPreviousMin: 45,
        estimatedArrivalTime: '12:45', deliveryStatus: 'DELIVERED' }] }],
  };
  const adapted = adaptBackendPlan(plan, {
    customers: [{ id: '1', name: 'Changed', phone: '', address: 'Changed', lat: 0, lng: 0 }],
    orders: [{ id: '1', customerId: '1', boxes: 3, status: 'pending', createdAt: '' }],
    riders: [{ id: '8', name: 'Different rider', phone: '', jobCode: '', color: 'blue' }],
  });
  expect(adapted.deadlineSafe).toBe(false);
  expect(adapted.startTime).toBe('12:00');
  expect(adapted.deliveryDeadline).toBe('12:40');
  expect(adapted.shop).toEqual(shop);
  expect(adapted.routes[0].rider.id).toBe('9');
  expect(adapted.routes[0].stops[0].customer.name).toBe('Saved customer');
  expect(adapted.routes[0].stops[0].customer.lat).toBe(16);
  expect(adapted.routes[0].stops[0].order.boxes).toBe(2);
  expect(adapted.routes[0].stops[0].order.status).toBe('delivered');
});
