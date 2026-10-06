import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, fromEvent, timer, timeout } from 'rxjs';
import { apiErrorMessage } from '../../core/api-error';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { todayLocal } from '../../core/backend-api.service';
import { RoutePlanApiService } from '../../core/route-plan-api.service';
import { AuthService } from '../../core/auth.service';
import { SHOP } from '../../core/models';
import { DeliveryRouteModel, RouteStopModel } from '../../core/route-plan.models';
import { RoutePlanMapComponent } from '../../shared/route-plan-map.component';

type Stage = 'entry' | 'summary' | 'delivery' | 'completed';

@Component({
  selector: 'app-rider',
  standalone: true,
  imports: [FormsModule, RoutePlanMapComponent],
  templateUrl: './rider.component.html',
})
export class RiderComponent implements OnInit {
  private readonly api = inject(RoutePlanApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef=inject(DestroyRef);
  newJobsMessage='';
  updatingJob=false;
  private loadedJobs=false;
  get unreadJobs():number { return this.jobs.filter(item=>!item.job.acknowledgedAt&&!['COMPLETED','CANCELLED'].includes(item.job.status ?? '')).length; }
  readonly shopPoint = signal<[number, number]>([SHOP.lat, SHOP.lng]);
  shopName = 'ร้าน';
  mapStart = '';
  jobs: Array<{ planId: number; job: DeliveryRouteModel; shop: { latitude: number; longitude: number; deliveryDeadline: string; shopName?: string; deliveryStartTime?: string } }> = [];
  jobQuery = '';
  filteredJobs() {
    const query = this.jobQuery.trim().toLowerCase();
    return this.jobs.filter(item => item.job.status !== 'CANCELLED' && (item.job.jobCode ?? '').toLowerCase().includes(query));
  }
  deliveryDeadline = '';
  activeRoute: DeliveryRouteModel | null = null;
  mapJobs: DeliveryRouteModel[] = [];
  activePlanId: number | null = null;
  stage: Stage = 'entry';
  stopIndex = 0;
  errorMessage = '';
  confirmingStop = false;
  loading = false;
  savingStop = false;
  currentPassword = '';
  newPassword = '';
  passwordMessage = '';
  changingPassword = false;

  get currentStop(): RouteStopModel | null { return this.activeRoute?.stops[this.stopIndex] ?? null; }

  get navigationUrl(): string | null {
    const stop = this.currentStop;
    if (!stop || !Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude) ||
        Math.abs(stop.latitude) > 90 || Math.abs(stop.longitude) > 180) return null;
    const params = new URLSearchParams({ api: '1', destination: `${stop.latitude},${stop.longitude}`, travelmode: 'driving', dir_action: 'navigate' });
    return `https://www.google.com/maps/dir/?${params}`;
  }

  ngOnInit(): void {
    this.loadJobs();
    // ponytail: polling suits this small dispatch app; use server push if measured traffic requires it.
    timer(20000,20000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(()=>{
      if(document.visibilityState==='visible'&&this.stage==='entry')this.loadJobs(true);
    });
    fromEvent(document,'visibilitychange').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(()=>{
      if(document.visibilityState==='visible'&&this.stage==='entry')this.loadJobs(true);
    });
  }

  loadJobs(background=false): void {
    if (this.loading) return;
    this.loading = true;
    if(!background)this.errorMessage = '';
    const token=this.auth.token();
    this.api.myJobs(todayLocal()).pipe(timeout(15000),takeUntilDestroyed(this.destroyRef)).subscribe({
      next: jobs => {
        if(token!==this.auth.token())return;
        this.loading = false;
        if(this.stage==='entry')this.errorMessage='';
        const previous=new Set(this.jobs.map(item=>item.job.jobId));
        const added=jobs.filter(item=>!previous.has(item.job.jobId)&&item.job.status!=='COMPLETED').length;
        if(this.loadedJobs&&added)this.newJobsMessage=`มีงานใหม่ ${added} ใบ กรุณาตรวจและรับทราบงาน`;
        this.loadedJobs=true;
        this.jobs = jobs;
        if (jobs[0]) {
          this.shopPoint.set([jobs[0].shop.latitude, jobs[0].shop.longitude]);
          this.deliveryDeadline = jobs[0].shop.deliveryDeadline;
        }
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.errorMessage = 'โหลดงานของคุณไม่สำเร็จ กรุณาลองใหม่'; this.cdr.markForCheck(); },
    });
  }

  selectJob(item: { planId: number; job: DeliveryRouteModel; shop: { latitude: number; longitude: number; deliveryDeadline: string; shopName?: string; deliveryStartTime?: string } }): void {
    if (item.job.status === 'CANCELLED') return;
    this.newJobsMessage='';
    this.errorMessage='';
    this.shopPoint.set([item.shop.latitude,item.shop.longitude]);
    this.deliveryDeadline=item.shop.deliveryDeadline;
    this.shopName = item.shop.shopName ?? 'ร้าน';
    this.mapStart = (item.job.estimatedStartTime ?? item.shop.deliveryStartTime ?? '').slice(0, 5);
    this.activeRoute = item.job;
    this.mapJobs = [item.job];
    this.activePlanId = item.planId;
    this.stopIndex = item.job.stops.findIndex(stop => stop.deliveryStatus !== 'DELIVERED');
    if (this.stopIndex < 0) this.stopIndex = item.job.stops.length;
    this.stage = this.stopIndex === item.job.stops.length ? 'completed' : item.job.status==='DELIVERING' ? 'delivery' : 'summary';
    this.confirmingStop = false;
    this.cdr.markForCheck();
  }
  acknowledge():void {
    const route=this.activeRoute;
    if(!route||route.jobId===undefined||this.updatingJob||route.acknowledgedAt)return;
    this.updatingJob=true;this.errorMessage='';
    this.api.acknowledgeMyJob(route.jobId).pipe(timeout(15000),takeUntilDestroyed(this.destroyRef)).subscribe({
      next:()=>{this.updatingJob=false;if(this.activeRoute!==route)return;route.acknowledgedAt=new Date().toISOString();this.cdr.markForCheck();},
      error:()=>{this.updatingJob=false;this.errorMessage='รับทราบงานไม่สำเร็จ กรุณารีเฟรชงานและลองใหม่';this.cdr.markForCheck();},
    });
  }
  begin(): void {
    const route=this.activeRoute;
    if(!this.currentStop||!route||route.jobId===undefined||this.updatingJob)return;
    if(!route.acknowledgedAt){this.errorMessage='กรุณารับทราบงานก่อนเริ่มส่ง';return;}
    this.updatingJob=true;this.errorMessage='';
    this.api.startMyJob(route.jobId).pipe(timeout(15000),takeUntilDestroyed(this.destroyRef)).subscribe({
      next:()=>{this.updatingJob=false;if(this.activeRoute!==route)return;route.status='DELIVERING';this.confirmingStop=false;this.stage='delivery';this.cdr.markForCheck();},
      error:()=>{this.updatingJob=false;this.errorMessage='เริ่มงานไม่สำเร็จ กรุณารีเฟรชงานและลองใหม่';this.cdr.markForCheck();},
    });
  }
  backToSummary(): void { this.confirmingStop = false; this.stage = 'summary'; }
  completeStop(): void {
    const stop = this.currentStop;
    if (!this.activeRoute || this.activePlanId === null || this.activeRoute.jobId === undefined ||
        !stop || this.stage !== 'delivery' || !this.confirmingStop || this.savingStop) return;
    const route = this.activeRoute;
    this.savingStop = true;
    this.errorMessage = '';
    this.api.deliverMyStop(this.activeRoute.jobId, stop.orderId).pipe(timeout(15000),takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.savingStop = false;
        if (this.activeRoute !== route) return;
        stop.deliveryStatus = 'DELIVERED';
        this.confirmingStop = false;
        this.stopIndex++;
        if (this.stopIndex >= route.stops.length) {this.stage = 'completed';route.status='COMPLETED';}
        this.cdr.markForCheck();
      },
      error: error => {
        this.savingStop = false;
        this.errorMessage = apiErrorMessage(error, 'บันทึกสถานะส่งไม่สำเร็จ กรุณารีเฟรชงานก่อนลองใหม่');
        this.cdr.markForCheck();
      },
    });
  }
  closeJob(): void { this.stage = 'entry'; this.activeRoute = null; this.mapJobs = []; this.activePlanId = null; this.errorMessage = ''; this.stopIndex = 0; this.confirmingStop = false; this.loadJobs(); }
  logout(): void { this.auth.logout(); void this.router.navigateByUrl('/login'); }
  changePassword(): void {
    if (this.changingPassword || this.newPassword.length < 12 || !this.currentPassword) return;
    this.changingPassword = true;
    this.passwordMessage = '';
    this.auth.changePassword(this.currentPassword, this.newPassword).pipe(timeout(15000), takeUntilDestroyed(this.destroyRef), finalize(() => { this.changingPassword = false; this.cdr.markForCheck(); })).subscribe({
      next: () => { this.currentPassword = ''; this.newPassword = ''; this.changingPassword = false; this.logout(); },
      error: error => { this.currentPassword = ''; this.newPassword = ''; this.passwordMessage = apiErrorMessage(error, 'เปลี่ยนรหัสผ่านไม่สำเร็จ ตรวจสอบรหัสเดิมและรหัสใหม่'); },
    });
  }
}
