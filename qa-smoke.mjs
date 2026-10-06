import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.error('Run BackEnd/scripts/qa-live.ts with explicit QA_ALLOW_REAL_DB=yes to supply real QA accounts and data.');
  process.exitCode = 1;
}

// Real frontend and backend only; credentials and QA records come from the caller.
export async function runSmoke({ baseURL, width, data, outputDir }) {
  const { chromium } = createRequire(import.meta.url)(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({executablePath: process.env.QA_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
  const context = await browser.newContext({baseURL,viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  const visible = l=>l.waitFor({state:'visible',timeout:25000});
  const response = (path,method='GET')=>{
    const pending=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${path}` && r.request().method()===method,{timeout:45000});
    // A failed click can close the page before this waiter is awaited; keep the original error and allow QA cleanup.
    pending.catch(()=>{});
    return pending;
  };
  const layout = async label=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false,`overflow ${label} @${width}`);
  const capture = name=>page.screenshot({path:join(outputDir,`${name}-${width}.png`),fullPage:true});
  const login = async (role,username)=>{
    await page.goto('/login');
    await page.getByLabel('ประเภทบัญชี').selectOption(role);
    await page.getByLabel('ชื่อผู้ใช้',{exact:true}).fill(username);
    await page.getByLabel('รหัสผ่าน',{exact:true}).fill(data.password);
    const loggedIn=response('/auth/login','POST');
    await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();
    const res=await loggedIn; assert.equal(res.status(),200,await res.text());
    await page.waitForURL(role==='OWNER'?'**/owner/delivery':'**/rider');
  };
  try {
    await mkdir(outputDir,{recursive:true});
    await login('OWNER',data.ownerUsername);
    if (data.readOnly) {
      for (const path of ['customers','orders','riders','settings','delivery']) {
        const endpoint=path==='delivery'?'/route-plans':`/${path}`;
        const loaded=response(endpoint);
        await page.goto(`/owner/${path}`);
        assert.equal((await loaded).status(),200);
        await visible(page.getByRole('heading').first());
        if (path==='settings') await visible(page.getByLabel('ชื่อร้าน',{exact:true}));
        else if (path==='delivery') await visible(page.getByRole('button',{name:'รีเฟรชรายการ',exact:true}));
        else if (path==='riders') await page.getByText('กำลังโหลด',{exact:false}).waitFor({state:'hidden'});
        else await page.waitForFunction(()=>{
          const form=document.querySelector('app-nearby-search fieldset');
          return form instanceof HTMLFieldSetElement && !form.disabled;
        });
        await layout(path); await capture(`page-${path}`);
      }
      assert.deepEqual(errors,[],'uncaught browser errors');
      console.log(`PASS read-only browser ${width}px: customers, orders, riders, settings, delivery`);
      return null;
    }
    for (const [path,radius] of [['customers',1],['orders',2]]) {
      await page.goto(`/owner/${path}`);
      const result=response(`/${path}/nearby`);
      await page.getByRole('checkbox',{name:`${path==='customers'?'ลูกค้า':'ออเดอร์'}ใกล้ร้าน`,exact:true}).check();
      const res=await result;
      assert.equal(res.status(),200);
      const rows=await res.json();
      const source=path==='customers'?data.customers:data.orders;
      const qaRows=rows.filter(row=>source.some(qa=>qa.id===row.id));
      const expected=path==='customers'?data.customers.slice(0,2):data.orders.filter(o=>o.customerId!==data.customers[4].id);
      assert.deepEqual(qaRows.map(r=>r.id).sort((a,b)=>a-b),expected.map(r=>r.id).sort((a,b)=>a-b));
      assert(qaRows.every(r=>r.distanceKm<=radius));
      if(path==='orders') {
        assert.equal(new URL(res.url()).searchParams.has('date'),false);
        assert.equal(new URL(res.url()).searchParams.has('status'),false);
      }
      await visible(page.getByText(/\d+\.\d{3} กม\./).first());
      await layout(path); await capture(path);
    }
    // CRUD a separate QA order through the real form/API; never mutate existing orders.
    await page.goto('/owner/orders');
    await page.getByRole('button',{name:'เพิ่มออเดอร์',exact:true}).click();
    const form=page.locator('aside form');
    await form.getByRole('textbox',{name:/เลือกลูกค้า/}).fill(data.customers[4].name);
    await form.getByRole('button',{name:new RegExp(data.customers[4].name)}).click();
    const createdResponse=response('/orders','POST');
    await form.getByRole('button',{name:'เพิ่มออเดอร์',exact:true}).click();
    const created=await createdResponse; assert.equal(created.status(),201);
    const temporary=await created.json();
    const orderRow=()=>page.getByRole('row').filter({hasText:String(temporary.id)});
    await visible(orderRow());
    await orderRow().getByRole('button',{name:'แก้ไข',exact:true}).click();
    await form.getByRole('button',{name:'เพิ่มจำนวนกล่อง',exact:true}).click();
    const updatedResponse=response(`/orders/${temporary.id}`,'PUT');
    await form.getByRole('button',{name:'บันทึก',exact:true}).click();
    const updated=await updatedResponse; assert.equal(updated.status(),200);
    assert.equal((await updated.json()).boxes,2);
    await page.reload();
    await visible(orderRow().getByText('2 กล่อง',{exact:true}));
    const deletedResponse=response(`/orders/${temporary.id}`,'DELETE');
    page.once('dialog',dialog=>dialog.accept());
    await orderRow().getByRole('button',{name:'ลบ',exact:true}).click();
    assert.equal((await deletedResponse).status(),204);
    await orderRow().waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>localStorage.getItem('smart-lunch-orders-v1')),null);

    // An API failure must clear dispatch data, show an error, and recover on retry.
    await page.route('**/api/orders?*',route=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"QA unavailable"}'}));
    await page.goto('/owner/delivery');
    await visible(page.getByText('โหลดข้อมูลจัดส่งไม่สำเร็จ กรุณาลองเชื่อมต่ออีกครั้ง',{exact:true}));
    assert.equal(await page.evaluate(()=>localStorage.getItem('smart-lunch-orders-v1')),null);
    await page.unroute('**/api/orders?*');
    await page.getByRole('button',{name:'ลองเชื่อมต่ออีกครั้ง',exact:true}).click();
    await page.getByText('โหลดข้อมูลจัดส่งไม่สำเร็จ กรุณาลองเชื่อมต่ออีกครั้ง',{exact:true}).waitFor({state:'hidden'});
    await page.getByText('เลือกออเดอร์ในรอบนี้',{exact:false}).click();
    for(const c of data.customers.slice(0,4)) await page.getByRole('checkbox',{name:new RegExp(c.name)}).check();
    await page.getByLabel('เริ่มส่ง',{exact:true}).fill('11:00');
    await page.getByLabel('เสร็จก่อน',{exact:true}).fill('14:00');
    const generated=page.waitForResponse(r=>/\/api\/route-plans\/(generate|recalculate)$/.test(r.url()) && r.request().method()==='POST',{timeout:45000});
    await page.getByRole('button',{name:/^(คำนวณเส้นทาง|คำนวณแผนใหม่)$/}).click();
    const first=await generated;
    assert.equal(first.status(),201,await first.text());
    const original=await first.json();
    const choose=page.getByRole('button',{name:'เลือกแผนใหม่',exact:true});
    if(await choose.isVisible()) await choose.click();
    await visible(page.getByRole('button',{name:'ตรวจทานแผน',exact:true}));
    const compared=response('/route-plans/recalculate','POST');
    await page.getByRole('button',{name:'คำนวณแผนใหม่',exact:true}).click();
    const next=await compared;
    assert.equal(next.status(),201,await next.text());
    const candidate=await next.json();
    const signature=p=>JSON.stringify(p.jobs.map(j=>JSON.stringify(j.stops.map(s=>s.orderId))).sort());
    assert.notEqual(signature(candidate),signature(original));
    assert.deepEqual(candidate.jobs.flatMap(j=>j.stops.map(s=>s.orderId)).sort((a,b)=>a-b),data.orders.filter(o=>o.status==='PENDING' && o.orderDate===candidate.planDate).map(o=>o.id).sort((a,b)=>a-b));
    await choose.click();
    await page.getByRole('button',{name:'ตรวจทานแผน',exact:true}).click();
    const assignments=page.getByRole('group',{name:'มอบหมายผู้รับเส้นทาง',exact:true}).getByRole('combobox');
    await visible(assignments.first());
    assert.equal(await assignments.count(),candidate.jobs.length);
    for(let i=0;i<candidate.jobs.length;i++) {
      const select=assignments.nth(i);
      await select.selectOption(await select.getByRole('option',{name:new RegExp(data.riders[i].name)}).getAttribute('value'));
    }
    const selected=response(`/route-plans/${candidate.routePlanId}/select`,'POST');
    await page.getByRole('button',{name:'ยืนยันและออกใบงาน',exact:true}).click();
    const selection=await selected;
    assert.equal(selection.status(),200,await selection.text());
    await layout('dispatch'); await capture('dispatch');
    for(let i=0;i<candidate.jobs.length;i++) {
      const rider=data.riders[i],job=candidate.jobs[i];
      await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
      await context.clearCookies();
      await login('RIDER',rider.username);
      const search=page.getByRole('searchbox',{name:'ค้นหารหัสใบงานของฉัน',exact:true});
      await search.fill('NO-SUCH-JOB');
      await visible(page.getByText('ไม่พบรหัสใบงานนี้ในงานของคุณวันนี้',{exact:true}));
      const otherJob=candidate.jobs.find(other=>other.jobId!==job.jobId);
      if(otherJob) {
        await search.fill(otherJob.jobCode);
        await visible(page.getByText('ไม่พบรหัสใบงานนี้ในงานของคุณวันนี้',{exact:true}));
        assert.equal(await page.getByRole('button',{name:new RegExp(`ใบงาน ${otherJob.jobCode}`)}).count(),0);
      }
      await search.fill(`  ${job.jobCode.toLowerCase()}  `);
      await page.getByRole('button',{name:new RegExp(`ใบงาน ${job.jobCode}`)}).click();
      await page.getByRole('button',{name:'รับทราบงานนี้',exact:true}).click();
      await visible(page.getByText('รับทราบงานแล้ว',{exact:true}));
      await page.getByRole('button',{name:'เริ่มส่งจุดแรก',exact:true}).click();
      for(const stop of job.stops) {
        const link=page.getByRole('link',{name:/นำทางด้วย Google Maps/});
        await visible(link);
        const url=new URL(await link.getAttribute('href'));
        assert.equal(url.searchParams.get('destination'),`${stop.latitude},${stop.longitude}`);
        assert.equal(url.searchParams.get('dir_action'),'navigate');
        assert.equal(url.searchParams.has('origin'),false);
        assert.equal(await link.getAttribute('target'),'_blank');
        await layout('rider'); if(stop.sequence===1) await capture(`rider-${i}`);
        await page.getByRole('button',{name:'ยืนยันส่งจุดนี้',exact:true}).click();
        const delivered=response(`/my-jobs/${job.jobId}/stops/${stop.orderId}/deliver`,'POST');
        await page.getByRole('button',{name:'ยืนยันส่งแล้ว',exact:true}).click();
        assert.equal((await delivered).status(),200);
        if(stop.sequence<job.stops.length) {
          await page.reload();
          await page.getByRole('searchbox',{name:'ค้นหารหัสใบงานของฉัน',exact:true}).fill(job.jobCode);
          await page.getByRole('button',{name:new RegExp(`ใบงาน ${job.jobCode}`)}).click();
          await visible(page.getByRole('heading',{name:`จุดที่ ${stop.sequence+1} จาก ${job.stops.length}`,exact:true}));
        }
      }
      await visible(page.getByRole('heading',{name:'ส่งครบแล้ว',exact:true}));
      await layout('completed');
    }
    assert.deepEqual(errors,[],'uncaught browser errors');
    console.log(`PASS browser ${width}px: CRUD, no order cache, API failure/retry, job search, reload delivery, radius, alternative, dispatch, navigation, layout`);
    return candidate.routePlanId;
  } catch(error) { console.error(error.message); await capture('failure'); throw error; }
  finally { await browser.close(); }
}
