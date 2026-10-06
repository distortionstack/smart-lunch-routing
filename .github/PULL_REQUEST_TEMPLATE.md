## สรุปการเปลี่ยนแปลง

อธิบายว่าการเปลี่ยนแปลงนี้ทำอะไร และอยู่ในส่วน frontend, backend หรือ integration

## พื้นที่ที่แก้

- [ ] `backend/**`
- [ ] `src/app/pages/**`
- [ ] `src/app/core/**`
- [ ] `src/app/shared/**`
- [ ] tests / QA
- [ ] shared config หรือเอกสาร

## ตรวจสอบแล้ว

- [ ] `npm.cmd test -- --watch=false`
- [ ] `npm.cmd run build`
- [ ] `npm.cmd run typecheck` ใน `backend/` ถ้าแก้ backend
- [ ] `npm.cmd test` ใน `backend/` ถ้าแก้ backend
- [ ] ไม่ได้แก้ไฟล์นอกขอบเขตโดยไม่จำเป็น
- [ ] ไม่มี secret หรือไฟล์ `.env` จริง

## Contract / migration

ถ้าเปลี่ยน API, model, database schema หรือ environment variable ให้ระบุรายละเอียดและผลกระทบไว้ตรงนี้
