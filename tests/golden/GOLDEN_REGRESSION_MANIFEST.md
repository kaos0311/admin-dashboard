# AHM Golden Regression Suite

Date: 2026-08-07

This suite is a small, high-value regression gate for critical business
invariants. It uses existing Vitest infrastructure only. The non-emulator suite
must not contact production Firebase, must not use PHI, and must not depend on
test order.

Emulator-backed Golden tests run only against `demo-advanced-home-medical` with
Firestore on `127.0.0.1:8085` and Auth on `127.0.0.1:9099`.

## Implemented Non-Emulator Scenarios

| ID | Scenario | Workflow | Severity | Layer | Emulator | Invariant |
|---|---|---|---|---|---|---|
| GOLDEN-INV-001 | Protected inventory metadata guard | Inventory writes | CRITICAL | Unit | No | Client/repository metadata helpers must reject stock, status, location, patient, and rental fields so counters cannot bypass movement workflows. |
| GOLDEN-INV-002 | Scanner normalization safety | Inventory scanning | HIGH | Unit | No | Scanner suffixes are stripped while leading zeroes remain intact, and URL/path-like scans remain invalid. |
| GOLDEN-INV-003 | Unknown scan state contract | Inventory scanning | HIGH | Unit | No | Unknown inventory scans remain distinguishable from valid inventory matches and retain the normalized scan value. |
| GOLDEN-IDEMP-001 | Receive operation retry identity | Inventory receive | CRITICAL | Unit | No | A retry reuses the same operation ID until the operation is completed or reset. |
| GOLDEN-AUTH-001 | Admin-only permission boundary | Authorization | CRITICAL | Unit | No | Admin and Tank hold admin-only permissions; Staff does not. |
| GOLDEN-AUTH-002 | Inactive user role resolution | Authorization | CRITICAL | Unit | No | Disabled or deleted user profiles cannot resolve an active role. |
| GOLDEN-ERR-001 | Known internal error safety | Error handling | HIGH | Unit | No | Known internal Firebase errors map to safe user-facing messages. |
| GOLDEN-ERR-002 | Unknown error fallback | Error handling | MEDIUM | Unit | No | Unknown errors fall back predictably without inventing a success state. |
| GOLDEN-DOM-001 | Workflow operation ID validation | Domain workflows | CRITICAL | Functions unit | No | Malformed or empty operation IDs are rejected before workflow state can be claimed. |
| GOLDEN-IDEMP-002 | Duplicate workflow operation result | Domain workflows | CRITICAL | Functions unit | No | Same actor, same operation ID, and same fingerprint returns one stable duplicate result. |
| GOLDEN-IDEMP-003 | Conflicting workflow operation key | Domain workflows | CRITICAL | Functions unit | No | Same actor and operation ID with different workflow data fails closed. |
| GOLDEN-AUTH-003 | Functions admin actor boundary | Functions authorization | CRITICAL | Functions unit | No | Admin and Tank actors are accepted for admin workflows; Staff is denied. |
| GOLDEN-DOM-002 | Rental state transition guard | Rental workflows | HIGH | Functions unit | No | Invalid rental state transitions are rejected with a controlled precondition error. |

## Implemented Emulator Scenarios

| ID | Scenario | Workflow | Severity | Layer | Emulator Dependency | Status | Invariant |
|---|---|---|---|---|---|---|---|
| GOLDEN-EMU-INV-001 | Movement success atomicity | Inventory movement | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Movement, operation, audit, and inventory state commit together. |
| GOLDEN-EMU-INV-002 | Movement failure rollback | Inventory movement | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Invalid movement leaves inventory unchanged and creates no orphan operation or movement. |
| GOLDEN-EMU-INV-003 | Duplicate movement idempotency | Inventory movement | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Same operation ID and same request creates one logical movement. |
| GOLDEN-EMU-REC-001 | Receive success exactly once | Inventory receive | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Receive movement writes one persisted receive mutation. |
| GOLDEN-EMU-REC-002 | Receive retry idempotency | Inventory receive | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Same receive operation ID does not double-adjust quantity. |
| GOLDEN-EMU-REC-003 | Receive conflicting key | Inventory receive | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Conflicting reuse of receive operation ID fails closed. |
| GOLDEN-EMU-REC-004 | Scanned intake create transaction ordering | Inventory receive | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Product-match create path performs all transaction reads before writes and remains idempotent. |
| GOLDEN-EMU-REC-005 | Scanned intake merge transaction ordering | Inventory receive | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Product-match merge path preserves catalog metadata and receive quantity without read-after-write failures. |
| GOLDEN-EMU-REC-006 | Scanned intake create rollback | Inventory receive | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Missing product rollback leaves no inventory, operation, or movement orphan records. |
| GOLDEN-EMU-REC-007 | Scanned intake retry and concurrency | Inventory receive | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Merge retries and concurrent duplicate operation IDs resolve to one logical movement. |
| GOLDEN-EMU-RENT-001 | Rental create/check-out atomicity | Rental workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Rental, inventory, patient equipment, timeline, audit, and operation record commit together. |
| GOLDEN-EMU-RENT-002 | Rental failure rollback | Rental workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Missing patient prevents rental creation, movement, and operation records. |
| GOLDEN-EMU-RENT-003 | Rental exchange atomicity | Rental workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Exchange return and replacement checkout update rental, inventory, patient equipment, timeline, audit, and operation state together. |
| GOLDEN-EMU-RENT-004 | Rental exchange rollback | Rental workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Unavailable replacement fails closed without returning the original asset or creating orphan exchange records. |
| GOLDEN-EMU-RENT-005 | Rental exchange retry idempotency | Rental workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Same exchange operation ID and request returns the stored result and does not duplicate return or checkout movements. |
| GOLDEN-EMU-RENT-006 | Rental exchange conflicting key | Rental workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Conflicting reuse of an exchange operation ID fails closed without changing the completed exchange. |
| GOLDEN-EMU-RENT-007 | Concurrent duplicate rental exchange | Rental workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Concurrent duplicate exchange requests produce one logical return and one logical replacement checkout. |
| GOLDEN-EMU-RENT-CALL-001 | Rental exchange callable unauthenticated denial | Rental workflow callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Missing callable auth is rejected before rental, equipment, movement, timeline, or audit mutation. |
| GOLDEN-EMU-RENT-CALL-002 | Rental exchange callable unauthorized role denial | Rental workflow callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Authenticated roles outside the supported staff/admin/tank set cannot invoke rental exchange side effects. |
| GOLDEN-EMU-RENT-CALL-003 | Rental exchange callable authorized success | Rental workflow callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Authorized staff caller reaches the domain workflow and commits rental, inventory, equipment, timeline, audit, and operation state. |
| GOLDEN-EMU-RENT-CALL-004 | Rental exchange callable disabled user denial | Rental workflow callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Disabled otherwise-authorized profile resolves to no active role and creates no rental exchange side effects. |
| GOLDEN-EMU-RENT-CALL-005 | Rental exchange callable malformed input denial | Rental workflow callable | HIGH | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Malformed callable payload fails closed with invalid-argument and no exchange mutation. |
| GOLDEN-EMU-RENT-CALL-006 | Rental exchange callable retry idempotency | Rental workflow callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Duplicate callable request with same operation ID and payload returns the stored result and creates one logical exchange. |
| GOLDEN-EMU-RENT-CALL-007 | Rental exchange callable conflict denial | Rental workflow callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Conflicting callable reuse of an operation ID fails closed without a second exchange. |
| GOLDEN-EMU-RENT-CALL-008 | Rental exchange callable rate-limit envelope | Rental workflow callable | HIGH | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Pre-exhausted general rate-limit bucket rejects the callable before domain mutation. |
| GOLDEN-EMU-RENT-RET-001 | Rental return atomicity | Rental return workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Successful return updates rental, inventory, patient equipment, movement, timeline, audit, and operation records together. |
| GOLDEN-EMU-RENT-RET-002 | Rental return rollback | Rental return workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Invalid return transition leaves rental, inventory, patient equipment, movement, timeline, audit, and operation state unchanged. |
| GOLDEN-EMU-RENT-RET-003 | Rental return retry idempotency | Rental return workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Duplicate return operation ID and payload returns stored result and creates one return movement. |
| GOLDEN-EMU-RENT-RET-004 | Rental return conflicting key | Rental return workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Conflicting reuse of return operation ID fails closed without a second mutation. |
| GOLDEN-EMU-RENT-RET-CALL-001 | Rental return callable unauthenticated denial | Rental return callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Missing callable auth is rejected before return side effects. |
| GOLDEN-EMU-RENT-RET-CALL-002 | Rental return callable unauthorized role denial | Rental return callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Unsupported authenticated role cannot execute rental return. |
| GOLDEN-EMU-RENT-RET-CALL-003 | Rental return callable authorized success | Rental return callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Authorized staff caller reaches return workflow and commits all return state. |
| GOLDEN-EMU-RENT-RET-CALL-004 | Rental return callable malformed input denial | Rental return callable | HIGH | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Malformed return callable payload fails closed with no mutation. |
| GOLDEN-EMU-RENT-RET-CALL-005 | Rental return callable rate-limit envelope | Rental return callable | HIGH | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Pre-exhausted general rate-limit bucket rejects return before domain mutation. |
| GOLDEN-EMU-RENT-CAN-001 | Rental cancellation atomicity | Rental cancel workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Valid cancellation updates rental, audit, and operation records without inventory movement side effects. |
| GOLDEN-EMU-RENT-CAN-002 | Rental cancellation rollback | Rental cancel workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Invalid checked-out cancellation leaves rental, inventory, equipment, audit, movement, and operation state unchanged. |
| GOLDEN-EMU-RENT-CAN-003 | Rental cancellation retry idempotency | Rental cancel workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Duplicate cancellation operation ID and payload returns stored result without duplicate audit state. |
| GOLDEN-EMU-RENT-CAN-004 | Rental cancellation conflicting key | Rental cancel workflow | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Conflicting reuse of cancellation operation ID fails closed after the first cancellation remains intact. |
| GOLDEN-EMU-RENT-CAN-CALL-001 | Rental cancellation callable unauthenticated denial | Rental cancel callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Missing callable auth is rejected before cancellation mutation. |
| GOLDEN-EMU-RENT-CAN-CALL-002 | Rental cancellation callable unauthorized role denial | Rental cancel callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Unsupported authenticated role cannot execute rental cancellation. |
| GOLDEN-EMU-RENT-CAN-CALL-003 | Rental cancellation callable authorized success | Rental cancel callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Authorized staff caller reaches cancellation workflow and commits rental, audit, and operation state. |
| GOLDEN-EMU-RENT-CAN-CALL-004 | Rental cancellation callable malformed input denial | Rental cancel callable | HIGH | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Malformed cancellation callable payload fails closed with no mutation. |
| GOLDEN-EMU-RENT-CAN-CALL-005 | Rental cancellation callable rate-limit envelope | Rental cancel callable | HIGH | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Pre-exhausted general rate-limit bucket rejects cancellation before domain mutation. |
| GOLDEN-EMU-PAT-ASSIGN-001 | Patient-equipment assignment atomicity | Patient equipment assignment | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Assignment, inventory state, movement, timeline, audit, and operation record commit together. |
| GOLDEN-EMU-PAT-ASSIGN-002 | Patient-equipment assignment rollback | Patient equipment assignment | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Already-assigned serialized equipment fails closed with no new movement, timeline, audit, or operation state. |
| GOLDEN-EMU-PAT-ASSIGN-003 | Patient-equipment assignment retry idempotency | Patient equipment assignment | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Duplicate assignment operation ID and payload returns stored result and creates one assignment movement. |
| GOLDEN-EMU-PAT-ASSIGN-004 | Patient-equipment assignment conflicting key | Patient equipment assignment | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Conflicting reuse of assignment operation ID fails closed without assigning another patient or asset. |
| GOLDEN-EMU-PAT-XFER-001 | Patient-equipment transfer atomicity | Patient equipment transfer | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Transfer closes the source assignment, opens the target assignment, updates inventory ownership, and writes one movement/audit/operation. |
| GOLDEN-EMU-PAT-XFER-002 | Patient-equipment transfer rollback | Patient equipment transfer | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Missing destination patient leaves the original assignment intact and creates no target assignment, movement, audit, timeline, or operation. |
| GOLDEN-EMU-PAT-CONC-001 | Concurrent duplicate patient-equipment assignment | Patient equipment concurrency | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Concurrent duplicate assignment requests create one active assignment and one movement. |
| GOLDEN-EMU-PAT-REM-001 | Patient-equipment removal atomicity | Patient equipment removal | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Removal closes the assignment, restores inventory availability, and writes movement, timeline, audit, and operation records together. |
| GOLDEN-EMU-PAT-REM-002 | Patient-equipment removal retry idempotency | Patient equipment removal | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Duplicate removal operation ID and payload returns stored result and creates one removal movement. |
| GOLDEN-EMU-PAT-REM-003 | Patient-equipment removal rollback | Patient equipment removal | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Removing a missing assignment fails closed and leaves available inventory unchanged. |
| GOLDEN-EMU-PAT-CALL-001 | Patient-equipment callable unauthenticated denial | Patient equipment callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Missing callable auth is rejected before assignment side effects. |
| GOLDEN-EMU-PAT-CALL-002 | Patient-equipment callable unauthorized role denial | Patient equipment callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Unsupported authenticated role cannot execute patient-equipment assignment. |
| GOLDEN-EMU-PAT-CALL-003 | Patient-equipment callable authorized success | Patient equipment callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Authorized staff caller reaches assignment workflow and commits inventory, equipment, movement, timeline, audit, and operation state. |
| GOLDEN-EMU-PAT-CALL-004 | Patient-equipment callable malformed input denial | Patient equipment callable | HIGH | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Malformed assignment callable payload fails closed with no mutation. |
| GOLDEN-EMU-PAT-CALL-005 | Patient-equipment callable disabled user denial | Patient equipment callable | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Disabled otherwise-authorized profile resolves to no active role and creates no patient-equipment side effects. |
| GOLDEN-EMU-PAT-CALL-006 | Patient-equipment callable rate-limit envelope | Patient equipment callable | HIGH | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Pre-exhausted general rate-limit bucket rejects assignment before domain mutation. |
| GOLDEN-EMU-AUTH-001 | Unauthenticated callable denial | Callable authorization | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Callable denies missing auth before protected movement succeeds. |
| GOLDEN-EMU-AUTH-002 | Non-admin admin-only denial | Callable authorization | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Non-admin caller cannot execute admin-only movement. |
| GOLDEN-EMU-AUTH-003 | Admin callable success | Callable authorization | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Authorized admin reaches callable movement execution. |
| GOLDEN-EMU-AUTH-004 | Disabled admin denial | Callable authorization | CRITICAL | Functions emulator | Firestore/Auth env | IMPLEMENTED/PASS | Disabled admin profile fails closed at callable authorization. |
| GOLDEN-EMU-RULE-001 | Protected inventory direct write denied | Firestore rules | CRITICAL | Rules emulator | Firestore rules | IMPLEMENTED/PASS | Staff cannot directly mutate protected inventory quantity. |
| GOLDEN-EMU-RULE-002 | Safe inventory metadata create allowed | Firestore rules | HIGH | Rules emulator | Firestore rules | IMPLEMENTED/PASS | Staff can still create safe inventory metadata with zero stock defaults. |
| GOLDEN-EMU-RULE-003 | Movement history client write denied | Firestore rules | CRITICAL | Rules emulator | Firestore rules | IMPLEMENTED/PASS | Clients cannot author inventory transaction history. |
| GOLDEN-EMU-CONC-001 | Concurrent duplicate movement | Inventory concurrency | CRITICAL | Functions emulator | Firestore | IMPLEMENTED/PASS | Concurrent duplicate movement requests create one logical mutation. |

## Proposed Scenario Classification

| # | Proposed Workflow | Classification | Priority | Notes |
|---:|---|---|---|---|
| 1 | Login/session create | READY | CRITICAL | Helper/API portions are unit-testable; browser path waits for E2E. |
| 2 | Disabled user login/session | READY | CRITICAL | Shared inactive-profile role behavior covered; full login is future E2E. |
| 3 | Role permission map | READY | CRITICAL | Covered by GOLDEN-AUTH-001 and existing role tests. |
| 4 | Protected route | BLOCKED | CRITICAL | Requires browser or component test stack; out of scope now. |
| 5 | Admin creates user | NEEDS EMULATOR | CRITICAL | Callable/Auth/Profile/Audit semantics require emulator or callable integration. |
| 6 | Staff attempts admin action | READY | CRITICAL | Pure admin boundary covered; callable enforcement remains emulator/callable pending. |
| 7 | Known scan lookup | READY | HIGH | Pure normalization covered; repository query semantics need emulator. |
| 8 | Duplicate scan lookup | NEEDS EMULATOR | CRITICAL | Duplicate query/no-mutation proof requires Firestore semantics. |
| 9 | Receive inventory success | NEEDS EMULATOR | CRITICAL | Counter, transaction, operation record atomicity requires Firestore emulator. |
| 10 | Receive inventory retry | NEEDS EMULATOR | CRITICAL | Existing emulator suite covers this when port 8080 is available. |
| 11 | Receive conflicting operation key | NEEDS EMULATOR | CRITICAL | Existing emulator pattern pending local emulator availability. |
| 12 | Create movement success | NEEDS EMULATOR | CRITICAL | Atomic movement/counter/audit transaction requires emulator. |
| 13 | Concurrent movement duplicate | NEEDS EMULATOR | CRITICAL | Concurrency semantics require emulator. |
| 14 | Invalid movement quantity | READY | HIGH | Pure operation ID and scan guards covered; full quantity rejection remains movement-service/emulator. |
| 15 | Rental create checked-out | NEEDS EMULATOR | CRITICAL | Transaction must prove rental, movement, patient equipment, timeline, audit, idempotency together. |
| 16 | Rental exchange | NEEDS EMULATOR | CRITICAL | Return + checkout atomicity requires emulator. |
| 17 | Patient equipment assignment | NEEDS EMULATOR | CRITICAL | Assignment/movement/timeline/audit atomicity requires emulator. |
| 18 | Delivery scan | NEEDS EMULATOR | HIGH | Callable transaction and movement update require emulator. |
| 19 | Firestore protected inventory write | DUPLICATE | CRITICAL | Static/runtime guard coverage exists; rules denial still needs emulator. |
| 20 | Firestore protected domain write | DUPLICATE | CRITICAL | Static/runtime guard coverage exists; rules denial still needs emulator. |
| 21 | Storage signature path | BLOCKED | HIGH | Storage emulator is not configured in current baseline. |
| 22 | Inventory UI success | BLOCKED | HIGH | Component test stack is explicitly out of scope. |
| 23 | Inventory UI permission denied | BLOCKED | HIGH | Component test stack is explicitly out of scope. |
| 24 | Dashboard navigation smoke | BLOCKED | HIGH | Browser E2E is explicitly out of scope. |
