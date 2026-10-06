import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import * as L from 'leaflet';
import { DeliveryMapComponent } from '../../shared/delivery-map/delivery-map.component';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  it('saves editable shop settings without sending the primary key', async () => {
    TestBed.configureTestingModule({ imports: [SettingsComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/settings').flush({ settingId: 1, shopName: 'ร้านเดิม', latitude: 16, longitude: 103,
      deliveryStartTime: '11:30:00', deliveryDeadline: '12:30:00', maxOrdersPerRider: 3,
      riderSpeedKmh: 30, boxSalePrice: 65, boxFoodCost: 40, riderBaseCost: 15, riderCostPerKm: 2 });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[name="shopName"]')).not.toBeNull();
    const picker = fixture.debugElement.query(By.directive(DeliveryMapComponent)).componentInstance as DeliveryMapComponent;
    const map = (picker as unknown as {map:L.Map}).map;
    expect(picker.showShop).toBe(false);
    let marker: L.Marker | undefined;
    map.eachLayer(layer => {if(layer instanceof L.Marker)marker=layer;});
    expect(marker?.options.draggable).toBe(true);
    const zoom=map.getZoom();
    marker!.setLatLng([16.123456,103.234567]).fire('dragend');
    fixture.detectChanges();
    expect(fixture.componentInstance.draft!.latitude).toBe(16.123456);
    expect(map.getZoom()).toBe(zoom);
    map.fire('click',{latlng:L.latLng(16.234567,103.345678)});
    fixture.detectChanges();
    expect(fixture.componentInstance.draft!.longitude).toBe(103.345678);
    fixture.componentInstance.draft!.shopName = 'ร้านใหม่';
    fixture.componentInstance.save();
    const request = http.expectOne('/api/settings');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.shopName).toBe('ร้านใหม่');
    expect(request.request.body.latitude).toBe(16.234567);
    expect(request.request.body.longitude).toBe(103.345678);
    expect(request.request.body.settingId).toBeUndefined();
    request.flush({ ...fixture.componentInstance.draft, settingId: 1 });
    http.verify();
  });
});
