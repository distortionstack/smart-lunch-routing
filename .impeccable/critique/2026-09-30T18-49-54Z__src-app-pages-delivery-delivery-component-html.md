---
target: delivery dispatch page
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
target_identity: "file:D:\\AdvanceWebProject\\FrontEnd\\src\\app\\pages\\delivery\\delivery.component.html"
target_fingerprint: "sha256:93e2e66235826c07a88d0bf64619f5c3e11c2766f81fb4a912b4d05ed0c508d8"
target_path: "D:\\AdvanceWebProject\\FrontEnd\\src\\app\\pages\\delivery\\delivery.component.html"
timestamp: 2026-09-30T18-49-54Z
slug: src-app-pages-delivery-delivery-component-html
---
# Critique — src/app/pages/delivery (ศูนย์จัดส่ง)

## Design Health Score — 21/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | fallback backend→local เงียบ ตัวเลขเปลี่ยนความหมายโดยไม่บอก |
| 2 | Match System / Real World | 3 | ศัพท์ไทยดี แต่มี English-mix ใน popup แผนที่ |
| 3 | User Control and Freedom | 2 | confirm ทางเดียว ไม่มี undo รีเฟรชแล้วหาย |
| 4 | Consistency and Standards | 2 | แผนที่สองตัวสองมาตรฐาน (ซูม สี หมุด ฟิลเตอร์) |
| 5 | Error Prevention | 2 | ยืนยันแผนที่รู้ว่าส่งไม่ทันได้โดยไม่มีแรงเสียดทาน |
| 6 | Recognition Rather Than Recall | 2 | jobCode ซ่อนก่อน confirm ต้องจำ mapping เอง |
| 7 | Flexibility and Efficiency | 1 | ไม่มี power path / deep link / keyboard flow |
| 8 | Aesthetic and Minimalist Design | 2 | กำไรโชว์ซ้ำ การ์ดทุกใบบานเต็มจอ |
| 9 | Error Recovery | 1 | tile พังมี retry แค่แผนที่เดียว fallback ไม่บอก |
| 10 | Help and Documentation | 3 | caveat ไทยดี แต่ตัวเล็กสีจางจะโดนข้าม |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** เขียนมาเพื่อโปรดักต์นี้จริง — หมุดร้าน 11:30, แบนเนอร์ deadline 12:30, กฎกล่อง 1–3, แยกค่าเรียกไรเดอร์กับค่าระยะทาง, เผย jobCode หลัง confirm, ความซื่อสัตย์เรื่องเส้นถนน vs เส้นตรง ไม่ใช่แดชบอร์ด generic จุดที่หลุดคือชั้นแผนที่ที่ยังมีความ generic รั่วอยู่

**Deterministic scan:** detector เจอ 1 advisory (`design-system-color` สีดำนอก palette ที่ line 0 — B ชี้ว่าน่าจะ false positive เพราะไม่มี literal ในซอร์ส) ไม่พบปัญหาอื่นในสามไฟล์เป้าหมาย แผนที่สองไฟล์สะอาด

**Visual overlays:** ไม่มี — session นี้ไม่มี browser automation จึง inject overlay ไม่ได้

## Overall Impression

โครงดี (calculate → review → confirm) ซื่อสัตย์เรื่องข้อจำกัด แต่จุดที่แพงที่สุดบนจอนี้ — ปุ่มยืนยัน — กลับเป็นจุดที่ป้องกันความผิดพลาดน้อยที่สุด

## What's Working

1. **Deadline เป็นพลเมืองชั้นหนึ่ง:** จุดสีการ์ดกำไร แบนเนอร์เขียว/แดง เวลารายคัน — เจ้าของเห็นคำสัญญา 12:30 ทุกระดับ
2. **Degradation ซื่อสัตย์:** เส้นประ + ป้าย approximate แยกชัดจากเส้นถนนจริง ไม่แกล้งแม่น
3. **Confirm เป็นขั้นเป็นตอน:** ตรวจทานก่อน รหัสใบงานเกิดหลัง commit ถูกต้องตามโมเดล

## Priority Issues

**[P0] ยืนยันแผนที่ส่งไม่ทันได้โดยไม่มีแรงเสียดทาน** — Why: กดพลาดทีเดียวตอนเร่งคือส่งสายทั้งกะ Fix: ถ้า !deadlineSafe ให้ติ๊ก "รับทราบว่าเกิน 12:30" + ปุ่มเป็นโทน danger บันทึก override ลง history (Suggested: $impeccable harden)

**[P1] fallback backend→local เงียบ เปลี่ยนความหมายตัวเลข** — Why: เจ้าของคิดว่าเห็นระยะถนนแต่จริงคือเส้นตรง ค่าใช้จ่าย/เวลาผิดทาง optimistic Fix: fallback แล้วขึ้น amber alert ค้างไว้จนกว่าจะ generate จาก backend สำเร็จ (Suggested: $impeccable clarify)

**[P2] แผนที่ backend ขาดฟิลเตอร์ไรเดอร์ + ปุ่ม retry** — Why: เส้น 7–10 สีทับกัน ตรวจคันที่สายไม่ได้ ทั้งที่โค้ด dim/highlight รองรับ selectedJob อยู่แล้ว Fix: ย้าย dropdown + retry จาก delivery-map มา (Suggested: $impeccable layout)

**[P3] การ์ดทุกใบบานเต็มจอ ดันต้นทุน/กำไรตกขอบ** — Why: 20–30 จุดสแกนไม่ไหว Fix: พับ stops ด้วย details กางอัตโนมัติเฉพาะคันที่สาย (Suggested: $impeccable distill)

**[P3] English-mix ในชั้นแผนที่** — `Approximate route (โดยประมาณ)`, legend `R01-2` Why: สะดุดสายตาคนอ่านไทย Fix: "เส้นทางโดยประมาณ (เส้นประ)" (Suggested: $impeccable clarify)

## Persona Red Flags

**Alex (power user):** ทุกอย่างหลัง calculate ใช้เมาส์ล้วน compare ให้แค่ delta ระยะรวมต้องอ่านการ์ดใหม่หมด chooseCandidate เตะออกจากโหมด review
**Sam (keyboard/SR):** ลำดับจุดส่ง เวลาถึง เส้นจริง/เส้นประ มีแค่ใน Leaflet popup ที่ SR เข้าไม่ถึง ป้าย ✓/! ไม่มี aria-label โค้ดสีไรเดอร์ไม่มี text equivalent
**Casey (มือถือ แสงจ้า):** ปุ่มคำนวณอยู่ใต้แผนที่ 430px ปุ่มยืนยันคู่กันเสี่ยงแตะผิด สถานะทัน/ไม่ทันพึ่งสีอย่างเดียว

## Minor Observations

- กำไรโชว์ซ้ำสองที่ (stat card + cost section)
- capacity "X / Y ออเดอร์" จริงคือ routes×3 ไม่ใช่กล่อง
- โหมดจำลองยังทำ ritual confirm เต็มได้ทั้งที่ข้อมูลไม่จริง
- "จุดเริ่มต้น 11:30" hardcode ในแผนที่สองไฟล์
- ROUTE_PALETTE 10 สียังไม่ตรวจตาบอดสี

## Questions to Consider

- ถ้าเจ้าของไว้ใจจอนี้พอจะปล่อยรถ 11:35 ทำไม disclaimer ยังบอกว่า "รีเฟรชแล้วสถานะจะหาย"?
- ถ้าจอนี้ตอบคำถามเดียวว่า "คันไหน ameaçar 12:30 และย้ายอะไร" พิกเซล 80% จะรอดไหม?
- OSRM ล่มตอน 11:15 แผนเส้นตรงที่เวลาชัดระดับนาที อันตรายกว่าไม่มีแผนเลยไหม?
