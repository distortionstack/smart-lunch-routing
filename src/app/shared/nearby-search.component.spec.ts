import { TestBed } from '@angular/core/testing';
import { NearbySearchComponent } from './nearby-search.component';
import { vi } from 'vitest';

describe('shop radius search',()=>{
  it('searches without coordinates and prevents a duplicate search while busy',()=>{
    TestBed.configureTestingModule({imports:[NearbySearchComponent]});
    const fixture=TestBed.createComponent(NearbySearchComponent);
    fixture.componentRef.setInput('radiusKm',1);fixture.componentRef.setInput('subject','ลูกค้า');
    const search=fixture.componentInstance;
    const emit=vi.spyOn(search.searched,'emit');
    search.search();expect(emit).toHaveBeenCalledWith(1);
    search.radius.set(0.5);search.search();expect(emit).toHaveBeenLastCalledWith(0.5);
    for(const radius of [null,0,-1,Infinity]){search.radius.set(radius);search.search();}
    expect(emit).toHaveBeenCalledTimes(2);
    fixture.componentRef.setInput('busy',true);
    search.search();expect(emit).toHaveBeenCalledTimes(2);
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('input[type="checkbox"]').disabled).toBe(true);
  });
});
