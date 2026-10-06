import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Mirror ของ backend ShopSettings (ดู backend src/models/shop-settings.model.ts) */
export interface ShopSettings {
  stopServiceMinutes?: number;
  settingId: number;
  shopName: string;
  latitude: number;
  longitude: number;
  /** "HH:MM:SS" */
  deliveryStartTime: string;
  /** "HH:MM:SS" */
  deliveryDeadline: string;
  maxOrdersPerRider: number;
  riderSpeedKmh: number;
  boxSalePrice: number;
  boxFoodCost: number;
  riderBaseCost: number;
  riderCostPerKm: number;
}

@Injectable({ providedIn: 'root' })
export class ShopSettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/settings`;

  get(): Observable<ShopSettings> {
    return this.http.get<ShopSettings>(this.url);
  }

  update(settings: Partial<ShopSettings>): Observable<ShopSettings> {
    return this.http.put<ShopSettings>(this.url, settings);
  }
}
