# Frontend issues #3 and #5 verification

## Scope

- [Issue #3: API-backed orders](https://github.com/Fokkio/smart-lunch-routing/issues/3): retire legacy order/plan localStorage snapshots and automatic demo fallback. Dispatch starts empty, accepts a complete API snapshot, and clears stale data on failure or a 15-second timeout. An error and retry control replace the demo banner. Existing order CRUD/filter API calls are reused.
- [Issue #5: rider delivery](https://github.com/Fokkio/smart-lunch-routing/issues/5): search job codes only within the authenticated rider's API-returned jobs. Normalize whitespace/case, support clearing the filter, and show a no-match message. Existing authenticated delivery updates and Google Maps links are reused.
- Mobile CRUD regression: clear old success feedback when opening an order form; the non-interactive feedback overlay no longer intercepts clicks.
- No new dependency, backend source change, migration, or Docker test in this patch. Legacy calculation fixtures remain explicit test helpers, not production API-error fallback.

## Checks

- `npm.cmd test -- --watch=false`: 76 tests passed in 17 files.
- `npm.cmd run build`: passed.
- `git diff --check`: passed.
- Real API/database browser flows: desktop 1440px and mobile-emulated 390px/360px passed. After discovering the feedback overlay bug, the corrected mobile flows were rerun successfully; the latest 360px run also explicitly checked another rider's actual job code.
- Browser flows cover QA order create/edit/reload/delete, absence of order localStorage, simulated HTTP 503 plus real-API retry, customer 1km/order 2km searches, distinct recalculated routes, assignment, own-job search, acknowledgement, delivery updates, reload/resume at the next stop, navigation link parameters, and layout. HTTP 503 is deliberately injected; CRUD/routing/delivery use the real backend/database.
- Completed QA delivery evidence includes selected plans 16099393 (desktop), 16099395 (390px), 16099397 (360px), and 16099399 (latest 360px). Each completed flow persisted four QA orders as DELIVERED.
- QA cleanup disabled test accounts and retained delivery evidence. Final read-only database inspection found zero active QA owners/riders. Existing non-QA records were not intentionally modified; the temporary CRUD order was deleted by its QA-only ID.

## Limits

- Mobile verification uses Chromium viewport emulation, not a physical phone. Google Maps destination/navigation links are checked; actual GPS, opening the native Maps app, and driving turn-by-turn were not tested.
- Tests exercise the affected workflow, not every possible production scenario.
- This branch does not change `main` until merged. The pull request should close #3 and #5 on merge.
