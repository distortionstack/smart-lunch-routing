import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, signal } from '@angular/core';
import * as L from 'leaflet';
import { Customer, RiderRoute, SHOP } from '../../core/models';

@Component({
  selector: 'app-delivery-map',
  standalone: true,
  template: `
    <div class="relative h-full min-h-80 w-full">
      <div #map class="h-full min-h-80 w-full bg-neu" role="region" aria-label="แผนที่จุดส่งและเส้นทางไรเดอร์"></div>
      @if (tilesUnavailable()) {
        <div class="absolute inset-x-3 top-16 z-500 rounded-xl border border-amber-300 bg-warning-soft p-3 text-sm text-amber-950" role="status">
          <strong class="block">พื้นแผนที่โหลดไม่ได้</strong>
          <p class="mt-1">จุดส่งยังแสดงอยู่ แต่ตำแหน่งถนนอาจดูไม่ได้ ตรวจการเชื่อมต่อแล้วลองใหม่</p>
          <button class="neu-control mt-2 min-h-11 rounded-lg px-3 font-bold" type="button" (click)="retryTiles()">ลองโหลดแผนที่อีกครั้ง</button>
        </div>
      }
      @if (routes.length) {
        <div class="neu-panel-soft absolute bottom-6 left-3 z-500 w-[min(280px,calc(100%-24px))] rounded-xl p-3 text-sm">
          <label class="block font-semibold text-ink">ดูเส้นทางไรเดอร์
            <select class="neu-field mt-1 min-h-11 w-full rounded-lg px-3 text-sm font-medium" [value]="selectedRiderId || ''" (change)="selectRoute($event)">
              <option value="">ทุกเส้นทาง ({{ routes.length }} คน)</option>
              @for (route of routes; track route.rider.id; let i = $index) { <option [value]="route.rider.id">R{{ String(i + 1).padStart(2, '0') }} · {{ route.rider.name }}</option> }
            </select>
          </label>
          <p class="mt-2 text-[13px] text-slate-600">สีเส้นและกรอบหมุดบอกไรเดอร์ · ป้าย R01-2 = ไรเดอร์คันที่ 1 จุดส่งที่ 2</p>
        </div>
      }
    </div>
  `,
})
export class DeliveryMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly String = String;
  readonly tilesUnavailable = signal(false);
  selectedRiderId: string | null = null;
  @Input() customers: Array<Pick<Customer, "name" | "lat" | "lng"> & { address: string | null }> = [];
  @Input() routes: RiderRoute[] = [];
  @Input() compact = false;
  @Input() pickable = false;
  @Input() showShop = true;
  @Input() shop: { lat: number; lng: number; name: string } = SHOP;
  @Input() startTime = '';
  @Input() selectedLocation: { lat: number; lng: number } | null = null;
  /** index เส้นทางที่ parent เลือก (แชร์กับการ์ด) — map กับ rider.id ข้างใน */
  @Input() selectedIndex: number | null = null;
  @Output() selectedIndexChange = new EventEmitter<number | null>();
  @Output() locationPicked = new EventEmitter<{ lat: number; lng: number }>();
  @ViewChild('map', { static: true }) mapElement!: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private tileLayer?: L.TileLayer;
  private layer?: L.FeatureGroup;

  ngAfterViewInit(): void {
    this.map = L.map(this.mapElement.nativeElement, { zoomControl: false }).setView([this.shop.lat, this.shop.lng], 14);
    // ปุ่มซูมอยู่ขวาล่าง — ซ้ายบนมีป้ายสถานะแผนทับอยู่ (ดู delivery.component.html)
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'ซูมเข้า', zoomOutTitle: 'ซูมออก' }).addTo(this.map);
    this.tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).on('loading', () => this.tilesUnavailable.set(false))
      .on('tileerror', () => this.tilesUnavailable.set(true))
      .addTo(this.map);
    this.render();
    if (this.pickable) this.map.on('click', ({ latlng }) => this.emitLocation(latlng));
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.syncSelectedIndex();
    if (this.selectedRiderId && !this.routes.some(route => route.rider.id === this.selectedRiderId)) this.selectedRiderId = null;
    if (this.map) this.render(!!_changes['selectedLocation'] && !Object.keys(_changes).some(key => key !== 'selectedLocation'));
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  retryTiles(): void {
    this.tilesUnavailable.set(false);
    this.tileLayer?.redraw();
  }

  selectRoute(event: Event): void {
    const id = (event.target as HTMLSelectElement).value || null;
    this.selectedRiderId = id;
    const index = id ? this.routes.findIndex(route => route.rider.id === id) : -1;
    this.selectedIndexChange.emit(index >= 0 ? index : null);
    this.render();
  }

  private syncSelectedIndex(): void {
    if (this.selectedIndex === null) {
      this.selectedRiderId = null;
      return;
    }
    const route = this.routes[this.selectedIndex];
    this.selectedRiderId = route ? route.rider.id : null;
  }

  isVisible(route: RiderRoute): boolean {
    return !this.selectedRiderId || route.rider.id === this.selectedRiderId;
  }

  private static validPoint(point: { lat: number; lng: number } | null | undefined): point is { lat: number; lng: number } {
    return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
  }

  private render(preserveView = false): void {
    if (!this.map) return;
    this.layer?.remove();
    this.layer = L.featureGroup().addTo(this.map);
    if (this.showShop) L.circleMarker([this.shop.lat, this.shop.lng], {
      radius: 9, color: '#111111', fillColor: '#ffffff', fillOpacity: 1, weight: 3,
    }).bindPopup(this.popup(this.shop.name, this.startTime ? `จุดเริ่มต้น ${this.startTime} น.` : 'จุดเริ่มต้น')).addTo(this.layer);

    if (this.routes.length) {
      this.routes.forEach((route, routeIndex) => {
        // ข้ามเส้นทางที่ข้อมูลไม่ครบ (ไรเดอร์หรือจุดส่งหาย) แทนที่จะพังทั้งแผนที่
        if (!route?.rider || !Array.isArray(route.stops)) return;
        if (!this.isVisible(route)) return;
        const routeLabel = `R${String(routeIndex + 1).padStart(2, '0')}`;
        const points: L.LatLngExpression[] = [[this.shop.lat, this.shop.lng]];
        route.stops.forEach((stop) => {
          if (!DeliveryMapComponent.validPoint(stop?.customer)) return;
          points.push([stop.customer.lat, stop.customer.lng]);
          L.marker([stop.customer.lat, stop.customer.lng], {
            title: `ไรเดอร์ ${routeLabel} จุดที่ ${stop.sequence} ${stop.customer.name}`,
            icon: L.divIcon({ className: 'route-sequence-pin', html: `<span style="--route-color:${route.rider.color}">${routeLabel}-${stop.sequence}</span>`, iconSize: [58, 44], iconAnchor: [29, 22] }),
          }).bindPopup(this.popup(`${routeLabel}-${stop.sequence} ${stop.customer.name}`, `${stop.order.boxes} กล่อง · ถึง ${stop.arrivalTime} น.`)).addTo(this.layer!);
        });
        L.polyline(points, { color: route.rider.color, weight: 5, opacity: 0.82, dashArray: '8 8' }).addTo(this.layer!);
      });
    } else {
      this.customers.forEach((customer) => {
        if (!DeliveryMapComponent.validPoint(customer)) return;
        L.circleMarker([customer.lat, customer.lng], {
          radius: 6, color: '#787774', fillColor: '#ffffff', fillOpacity: 1, weight: 2,
        }).bindPopup(this.popup(customer.name, customer.address ?? '')).addTo(this.layer!);
      });
    }

    if (this.pickable && DeliveryMapComponent.validPoint(this.selectedLocation)) {
      L.marker([this.selectedLocation.lat, this.selectedLocation.lng], {
        draggable: true,
        title: 'ลากหมุดเพื่อเลือกตำแหน่ง',
        icon: L.divIcon({ className: 'location-pin', html: '<span></span>', iconSize: [44, 44], iconAnchor: [22, 34] }),
      }).on('dragend', (event) => this.emitLocation(event.target.getLatLng())).addTo(this.layer);
    }

    const bounds = this.layer.getBounds();
    if (!preserveView && bounds.isValid()) this.map.fitBounds(bounds.pad(this.compact ? 0.12 : 0.2), { maxZoom: this.selectedRiderId ? 17 : 15 });
  }

  private emitLocation(latlng: L.LatLng): void {
    this.locationPicked.emit({ lat: Number(latlng.lat.toFixed(6)), lng: Number(latlng.lng.toFixed(6)) });
  }

  private popup(title: string, detail: string): HTMLElement {
    const content = document.createElement('div');
    const heading = document.createElement('strong');
    const description = document.createElement('div');
    heading.textContent = title;
    description.textContent = detail;
    content.append(heading, description);
    return content;
  }
}
