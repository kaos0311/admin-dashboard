# Advanced Home Medical v2 Architecture

## Goal

Build a fast, clean operations platform with clear separation between UI, business rules, database access, authentication, and AI assistance.

## Layer Rules

### UI Layer
Location:
- src/app
- src/components

Responsibilities:
- Render pages
- Handle user interaction
- Show loading, empty, and error states
- Call hooks or services
- Never contain complex business rules
- Never directly perform high-risk database deletes

### Hook Layer
Location:
- feature hooks under src/app/(admin)/...
- shared hooks under src/hooks

Responsibilities:
- Manage React state
- Subscribe to realtime data
- Call services
- Convert service results into UI state

### Service Layer
Location:
- src/services

Responsibilities:
- Business rules
- Workflow orchestration
- Validation
- Cross-record decisions
- Calling repositories
- No JSX
- No React imports

### Repository Layer
Location:
- src/repositories

Responsibilities:
- Database reads and writes
- Prisma queries
- Firestore queries
- No UI logic
- No toast
- No React state

### Data Sources

Postgres:
- structured business data
- equipment
- models
- customers
- locations
- orders
- inventory records that require relational integrity

Firebase Auth:
- sign in
- identity
- role checks

Firestore:
- realtime operational data
- audit logs
- import jobs
- notifications
- temporary settings
- operational events

Jarvis / SixthAI:
- analysis
- recommendations
- summarization
- anomaly detection
- workflow assistance

## Dependency Direction

Allowed:

UI -> Hooks -> Services -> Repositories -> Database

Not allowed:

Repositories -> Services
Services -> UI
Services -> React
Repositories -> React
Database code inside page components

## Page Size Targets

Pages:
- 200 to 400 lines preferred

Components:
- under 200 lines preferred

Hooks:
- 100 to 250 lines preferred

Services:
- focused files, usually under 300 lines

## Current Priorities

1. Keep one app shell.
2. Move business logic out of large pages.
3. Move database access into repositories.
4. Keep Firestore deletes server-side for high-risk operations.
5. Keep dashboards action-first, not chart-heavy.
