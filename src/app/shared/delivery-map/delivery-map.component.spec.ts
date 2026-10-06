import { DeliveryMapComponent } from './delivery-map.component';
import { DEMO_RIDERS } from '../../core/demo-data';
import { RiderRoute } from '../../core/models';

describe('DeliveryMapComponent tile fallback', () => {
  it('clears the unavailable state when retrying tiles', () => {
    const component = new DeliveryMapComponent();
    component.tilesUnavailable.set(true);

    component.retryTiles();

    expect(component.tilesUnavailable()).toBe(false);
  });

  it('shows one selected rider and resets the filter when that rider disappears', () => {
    const component = new DeliveryMapComponent();
    const first = { rider: DEMO_RIDERS[0] } as RiderRoute;
    const second = { rider: DEMO_RIDERS[1] } as RiderRoute;
    component.routes = [first, second];

    component.selectRoute({ target: { value: second.rider.id } } as unknown as Event);
    expect(component.isVisible(first)).toBe(false);
    expect(component.isVisible(second)).toBe(true);

    component.routes = [first];
    component.ngOnChanges({});
    expect(component.selectedRiderId).toBeNull();
  });
});
