---
target: delivery dispatch page
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:D:\\AdvanceWebProject\\FrontEnd\\src\\app\\pages\\delivery\\delivery.component.html"
target_fingerprint: "sha256:99de47519e837cbc0b9279f31567e9e483f46962403fe5479061af0ef0d2470c"
target_path: "D:\\AdvanceWebProject\\FrontEnd\\src\\app\\pages\\delivery\\delivery.component.html"
timestamp: 2026-09-30T19-00-11Z
slug: src-app-pages-delivery-delivery-component-html
---
# Critique R2 — src/app/pages/delivery (ศูนย์จัดส่ง)

## Score — 22/40 (Acceptable), prev 21/40

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | compare shows distance only |
| 2 | Match System / Real World | 3 | 11:30 start hidden |
| 3 | User Control and Freedom | 2 | no undo, filter resets silently |
| 4 | Consistency and Standards | 2 | two filter dialects, three button styles |
| 5 | Error Prevention | 3 | ack gate real; disabled buttons unexplained |
| 6 | Recognition Rather Than Recall | 2 | Kantee-N vs R01 vs name cross-walk |
| 7 | Flexibility and Efficiency | 1 | per-card clicks, no diff, no expand-all |
| 8 | Aesthetic and Minimalist Design | 3 | collapse helps; sidebar still long |
| 9 | Error Recovery | 2 | amber has no retry; bad order not named |
| 10 | Help and Documentation | 2 | simulation disclaimer small grey |
| **Total** | | **22/40** | **Acceptable** |

## Remaining

**[P0] Compare on distance alone** — swapping to shorter-but-late plan possible; chooseCandidate resets ack silently. Fix: finish time + chip + profit both columns; require ack for late candidate.
**[P1] Map filter desync + dialects** — selection not shared with cards; labels differ. Fix: lift state to parent, unify R01 label.
**[P1] Disabled without reason** — review + late confirm dead-ends. Fix: aria-disabled + hint + focus move.
**[P2] No late-by-how-much** — marginMinutes unrendered. Fix: over-by chip, late first.

## Personas

Alex: per-card clicks, no diff, kicked out of review. Sam: labels improved; popups off tab order; disabled silent. Casey: long scroll, nested scroll trap, summary wrap.
