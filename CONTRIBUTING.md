# แนวทางทำงานร่วมกันในทีม

ระบบแยกเป็นสอง repository และติดตามงานร่วมกันใน [Smart Lunch Routing - Full Stack Team](https://github.com/users/Fokkio/projects/2)

- Frontend: [Fokkio/smart-lunch-routing](https://github.com/Fokkio/smart-lunch-routing)
- Backend: [Fokkio/smart-lunch-routing-backend](https://github.com/Fokkio/smart-lunch-routing-backend)

## การแบ่งงานแบบ full stack

สมาชิกแต่ละคนรับผิดชอบหนึ่งฟีเจอร์ทั้ง frontend และ backend:

| คน | ฟีเจอร์ | Frontend Issue | Backend Issue |
|---|---|---|---|
| คนที่ 1 | ลูกค้า | [#2](https://github.com/Fokkio/smart-lunch-routing/issues/2) | [#1](https://github.com/Fokkio/smart-lunch-routing-backend/issues/1) |
| คนที่ 2 | ออเดอร์ | [#3](https://github.com/Fokkio/smart-lunch-routing/issues/3) | [#2](https://github.com/Fokkio/smart-lunch-routing-backend/issues/2) |
| คนที่ 3 | จัดเส้นทางและแผนที่ | [#4](https://github.com/Fokkio/smart-lunch-routing/issues/4) | [#3](https://github.com/Fokkio/smart-lunch-routing-backend/issues/3) |
| คนที่ 4 | ใบงานไรเดอร์และสถานะจัดส่ง | [#5](https://github.com/Fokkio/smart-lunch-routing/issues/5) | [#4](https://github.com/Fokkio/smart-lunch-routing-backend/issues/4) |

ให้เปิด Pull Request แยกในแต่ละ repository และใส่ลิงก์ Issue ที่เกี่ยวข้องในคำอธิบาย PR

## Branch และ Pull Request

ห้าม push ตรงเข้า `main` ใช้ชื่อ branch เดียวกันในสอง repository ตามฟีเจอร์ เช่น:

```text
feat/customer-management
feat/order-management
feat/route-planning
feat/rider-workflow
```

เริ่มงานจาก `main` ล่าสุด:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feat/ชื่อ-งาน
```

ก่อนเปิด Pull Request:

```powershell
git add <ไฟล์ที่เกี่ยวข้อง>
git commit -m "อธิบายการเปลี่ยนแปลง"
git fetch origin
git rebase origin/main
git push -u origin feat/ชื่อ-งาน
```

ให้สมาชิกอีกคน review อย่างน้อยหนึ่งคน ห้ามใช้ `git push --force` กับ `main`

## API contract ที่ต้องใช้ร่วมกัน

ก่อนเชื่อมแต่ละฟีเจอร์ ให้ตกลงเรื่องต่อไปนี้ใน Issues คู่ frontend/backend:

- ชนิดของ ID
- ชื่อและค่าของ status
- request และ response fields
- รูปแบบ error response
- พิกัด `lat/lng` หรือ `latitude/longitude`
- รูปแบบรหัสใบงานไรเดอร์

Frontend ต้องแสดงข้อมูลที่ backend ส่งมา และไม่คำนวณ routing, เวลา หรือต้นทุนซ้ำเมื่อเปลี่ยนไปใช้ API จริง

## ตรวจสอบก่อน merge

Frontend:

```powershell
npm.cmd test -- --watch=false
npm.cmd run build
```

Backend ให้รันจาก repository `smart-lunch-routing-backend`:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```
