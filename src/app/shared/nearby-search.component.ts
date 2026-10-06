import { Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-nearby-search', standalone: true, imports:[FormsModule],
  template: `<div class="flex flex-wrap items-center gap-2"><label class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold"
    [class.border-blue-500]="active()" [class.bg-blue-50]="active()" [class.text-blue-800]="active()"
    [class.border-slate-200]="!active()" title="ระยะเส้นตรงจากที่ตั้งร้านที่บันทึกไว้">
    <input class="size-4 accent-blue-600" type="checkbox" [checked]="active()" [disabled]="busy()"
      (change)="toggle($event)" />
    {{ subject() }}ใกล้ร้าน
  </label>
    <label class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">รัศมี
      <input class="neu-field min-h-11 w-24 rounded-xl px-3" type="number" min="0" step="any"
        [ngModel]="radius()" (ngModelChange)="radius.set($event)" [ngModelOptions]="{standalone:true}" [disabled]="busy()"
        (keydown.enter)="search(); $event.preventDefault()" [attr.aria-label]="'รัศมีค้นหา'+subject()+' (กม.)'" /> กม.
    </label>
    <button class="neu-control min-h-11 rounded-xl px-3 text-sm font-semibold" type="button" [disabled]="busy()" (click)="search()">ใช้รัศมี</button>
    @if(error){<p class="w-full text-sm text-red-800" role="alert">{{error}}</p>}
  </div>`,
})
export class NearbySearchComponent {
  readonly radiusKm = input.required<number>();
  readonly subject = input.required<string>();
  readonly busy = input(false);
  readonly active = input(false);
  readonly radius = linkedSignal<number|null>(()=>this.radiusKm());
  readonly searched = output<number>();
  readonly cleared = output<void>();
  error='';
  toggle(event:Event):void {
    const checkbox=event.target as HTMLInputElement;
    if(checkbox.checked){if(!this.search())checkbox.checked=this.active();}
    else{this.error='';this.cleared.emit();}
  }
  search():boolean {
    if(this.busy())return false;
    const radius=this.radius();
    if(radius===null||!Number.isFinite(radius)||radius<=0){this.error='กรอกรัศมีเป็นจำนวนมากกว่า 0 กม.';return false;}
    this.error='';this.searched.emit(radius);return true;
  }
}
