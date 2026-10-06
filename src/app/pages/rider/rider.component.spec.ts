import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RiderComponent } from './rider.component';
import {vi,afterEach} from 'vitest';

describe('Rider assigned jobs', () => {
  afterEach(()=>vi.useRealTimers());
  it('searches only API-assigned job codes with case/space normalization and a no-match state', () => {
    TestBed.configureTestingModule({ imports: [RiderComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RiderComponent);
    fixture.detectChanges();
    const item = (code: string, id: number) => ({planId: 5, shop: {latitude: 16, longitude: 103, deliveryDeadline: '12:30'}, job: {jobId: id, jobCode: code, status: 'WAITING', totalBoxes: 1, distanceKm: 1, stops: []}});
    http.expectOne(req => req.url === '/api/my-jobs').flush([item('P123-R1', 1), item('P124-R2', 2)]);
    const rider = fixture.componentInstance;
    rider.jobQuery = '  p123-r1  ';
    expect(rider.filteredJobs().map(item => item.job.jobCode)).toEqual(['P123-R1']);
    rider.jobQuery = 'P999-R9';
    expect(rider.filteredJobs()).toEqual([]);
    fixture.changeDetectorRef.markForCheck(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ไม่พบรหัสใบงานนี้');
    rider.jobQuery = '  ';
    expect(rider.filteredJobs()).toHaveLength(2);
    fixture.destroy(); http.verify(); // Searching never requests an arbitrary job-code endpoint.
  });

  it('restores delivered stops from a fresh API load and resumes at the next stop', () => {
    TestBed.configureTestingModule({ imports: [RiderComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RiderComponent);
    fixture.detectChanges();
    http.expectOne(req => req.url === '/api/my-jobs').flush([{
      planId: 5, shop: {latitude: 16, longitude: 103, deliveryDeadline: '12:30'}, job: {
        jobId: 7, jobCode: 'P5-R1', status: 'DELIVERING', acknowledgedAt: '2026-10-05T00:00:00Z',
        stops: [{orderId: 10, deliveryStatus: 'DELIVERED', latitude: 16.1, longitude: 103.1}, {orderId: 11, deliveryStatus: 'WAITING', latitude: 16.2, longitude: 103.2}],
      },
    }]);
    const rider = fixture.componentInstance;
    rider.selectJob(rider.jobs[0]);
    expect(rider.stage).toBe('delivery');
    expect(rider.stopIndex).toBe(1);
    expect(new URL(rider.navigationUrl!).searchParams.get('destination')).toBe('16.2,103.2');
    fixture.destroy(); http.verify();
  });
  it('refreshes the visible waiting screen, announces new jobs and stops on destroy',async()=>{
    vi.useFakeTimers();
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
    TestBed.configureTestingModule({imports:[RiderComponent],providers:[provideHttpClient(),provideHttpClientTesting()]});
    const http=TestBed.inject(HttpTestingController);
    const fixture=TestBed.createComponent(RiderComponent);
    fixture.detectChanges();
    http.expectOne(req=>req.url==='/api/my-jobs').flush([]);
    await vi.advanceTimersByTimeAsync(20000);
    http.expectOne(req=>req.url==='/api/my-jobs').flush([{planId:5,shop:{latitude:16,longitude:103,deliveryDeadline:'14:00'},job:{jobId:7,status:'WAITING',acknowledgedAt:null,stops:[]}}]);
    expect(fixture.componentInstance.newJobsMessage).toContain('มีงานใหม่ 1');
    expect(fixture.componentInstance.unreadJobs).toBe(1);
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(20000);
    http.expectNone(req=>req.url==='/api/my-jobs');
    http.verify();
  });
  it('persists a completed stop before advancing', async () => {
    TestBed.configureTestingModule({
      imports: [RiderComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RiderComponent);
    const rider = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne((req) => req.url === '/api/my-jobs' && req.params.has('date')).flush([{
      planId: 5, shop: { latitude: 16.1, longitude: 103.1, deliveryDeadline: '12:30' }, job: {
        jobId: 7, jobCode: 'JOB-1', totalBoxes: 2, distanceKm: 1,
        durationMinutes: 5, stops: [{
          sequence: 1, orderId: 10, customerName: 'ลูกค้า', deliveryStatus: 'WAITING',
          boxCount: 2, latitude: 16.2, longitude: 103.2,
        }],
      },
    }]);
    expect(rider.jobs).toHaveLength(1);
    rider.selectJob(rider.jobs[0]);
    expect(rider.stage).toBe('summary');
    expect(rider.mapJobs).toHaveLength(1);
    await fixture.whenStable();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-route-plan-map')).not.toBeNull();
    rider.begin();
    expect(rider.stage).toBe('summary');
    expect(rider.errorMessage).toContain('รับทราบ');
    rider.acknowledge();
    expect(rider.activeRoute?.acknowledgedAt).toBeUndefined();
    http.expectOne('/api/my-jobs/7/acknowledge').flush({acknowledged:true});
    rider.begin();
    expect(rider.stage).toBe('summary');
    http.expectOne('/api/my-jobs/7/start').flush({started:true});
    expect(rider.stage).toBe('delivery');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    await fixture.whenStable();
    const stopMap = fixture.nativeElement.querySelector('app-route-plan-map');
    expect(stopMap).not.toBeNull();
    const navigation = fixture.nativeElement.querySelector('a[href*="google.com/maps"]') as HTMLAnchorElement;
    expect(navigation).not.toBeNull();
    const navigationUrl = new URL(navigation.href);
    expect(navigationUrl.searchParams.get('destination')).toBe('16.2,103.2');
    expect(navigationUrl.searchParams.get('dir_action')).toBe('navigate');
    expect(navigationUrl.searchParams.has('origin')).toBe(false);
    expect(navigation.target).toBe('_blank');
    expect(navigation.rel).toContain('noopener');
    const stop = rider.currentStop!;
    stop.latitude = NaN;
    expect(rider.navigationUrl).toBeNull();
    stop.latitude = 91;
    expect(rider.navigationUrl).toBeNull();
    stop.latitude = 16.3;
    expect(new URL(rider.navigationUrl!).searchParams.get('destination')).toBe('16.3,103.2');
    stop.latitude = 16.2;
    rider.confirmingStop = true;
    rider.completeStop();
    expect(rider.stage).toBe('delivery');
    http.expectOne('/api/my-jobs/7/stops/10/deliver')
      .flush({}, { status: 500, statusText: 'Server error' });
    expect(rider.stage).toBe('delivery');
    expect(rider.stopIndex).toBe(0);
    rider.completeStop();
    http.expectOne('/api/my-jobs/7/stops/10/deliver').flush({ delivered: true });
    expect(rider.stage).toBe('completed');
    expect(rider.navigationUrl).toBeNull();
    http.verify();
  });
});
