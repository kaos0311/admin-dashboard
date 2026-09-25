# Deployment

## Overview

The AHM Admin Dashboard deploys as two separate components:

1. **Next.js Application** — the web frontend and API routes
2. **Firebase Cloud Functions** — server-side business logic

Firebase configuration (Firestore rules, indexes, Storage rules) is
deployed via the Firebase CLI.

## Firebase Project

| Property | Value |
|---|---|
| Project ID | `advanced-home-medical-55772` |
| Default region | `us-central1` |
| Config file | `.firebaserc` |

```json
{
  "projects": {
    "default": "advanced-home-medical-55772"
  }
}
```

## Firebase CLI Configuration

**File:** `firebase.json`

```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"],
      "ignore": [
        "node_modules", ".git", "*.log", "*.local",
        ".runtimeconfig.json", "serviceAccountKey.json",
        "**/serviceAccountKey.json", "**/*serviceAccount*.json",
        "**/firebase-adminsdk*.json"
      ]
    }
  ],
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

### Predeploy Hook

The functions predeploy hook runs `npm run build` (which executes `tsc`)
inside the `functions/` directory before deploying. This ensures the
TypeScript source is compiled to `lib/` before deployment.

### Ignored Files

The following patterns are excluded from Cloud Functions deployment:

- `node_modules`
- `.git`
- Log files (`*.log`, `firebase-debug.*.log`)
- Local files (`*.local`)
- `.runtimeconfig.json`
- Service account keys (`serviceAccountKey.json`,
  `**/serviceAccountKey.json`, `**/*serviceAccount*.json`,
  `**/firebase-adminsdk*.json`)

## Deployment Commands

### Deploy Everything

```bash
firebase deploy
```

### Deploy Cloud Functions Only

```bash
# From the functions directory
cd functions && npm run deploy

# Or from the project root
firebase deploy --only functions
```

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Deploy Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

### Deploy Storage Rules

```bash
firebase deploy --only storage
```

## Cloud Functions Build

**File:** `functions/package.json`

| Script | Command | Purpose |
|---|---|---|
| `build` | `tsc` | Compile TypeScript to `lib/` |
| `watch` | `tsc --watch` | Watch mode compilation |
| `serve` | `npm run build && firebase emulators:start --only functions` | Build + start emulators |
| `deploy` | `firebase deploy --only functions` | Deploy functions |
| `logs` | `firebase functions:log` | View function logs |
| `clean` | `rimraf lib` | Clean build output |
| `rebuild` | `npm run clean && npm run build` | Full rebuild |

### Functions TypeScript Config

**File:** `functions/tsconfig.json`

- Target: ES2022
- Module: NodeNext
- Output: `lib/`
- Source maps: enabled
- Strict mode: enabled

### Functions Runtime

- **Node.js 22** (specified in `functions/package.json` `engines.node`)
- **firebase-functions v7** (Cloud Functions v2 API)
- **firebase-admin v13**

## Cloud Functions Global Options

**File:** `functions/src/index.ts`

```typescript
setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});
```

All functions inherit these defaults unless overridden.

## Next.js Build

### Build Configuration

**File:** `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["app.adhvomemed.com"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ["firebase-admin"],
};
```

Key settings:
- `reactStrictMode: true` — React strict mode
- `poweredByHeader: false` — removes `X-Powered-By` header
- `serverActions.bodySizeLimit: "10mb"` — allows large server action payloads
- `serverExternalPackages: ["firebase-admin"]` — firebase-admin is bundled
  server-side
- `allowedDevOrigins: ["app.adhvomemed.com"]` — allowed dev origin

### Build Commands

```bash
# Development
npm run dev          # next dev

# Production build
npm run build        # next build

# Start production server
npm run start        # next start
```

## Environment Variables

### Required for Client

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` | reCAPTCHA Enterprise site key for App Check |
| `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` | App Check debug token (dev only) |

### Required for Server

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for Prisma |
| `OPENAI_API_KEY` | OpenAI API key (Cloud Functions secret) |
| `CHATGPT_API_KEY` | ChatGPT bridge API key |

### Firebase Admin Credentials for Next.js

The Next.js server and API routes use `src/lib/firebaseAdmin.ts`.
Credential resolution is intentionally fail-closed:

1. Reuse an existing initialized Firebase Admin app.
2. Use Application Default Credentials when the deployment runtime
   provides them, such as Google-managed hosting or
   `GOOGLE_APPLICATION_CREDENTIALS`. A project ID by itself is not a
   credential.
3. Use explicit environment credentials:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`, containing the full service-account
     JSON as one secret value; or
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
     `FIREBASE_PRIVATE_KEY`.
4. For local development only, set
   `FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH` to a local JSON key file. This
   path is refused when `NODE_ENV=production`.

Production does not require `serviceAccountKey.json` in the project root.
Do not deploy service-account JSON files with the app and do not print
credential values in logs.

Local emulator tests do not use production credentials. They run with
`GCLOUD_PROJECT=demo-advanced-home-medical`, localhost emulator hosts, and no
service-account JSON. If a local service-account file is retained for
non-emulator admin scripts, keep it outside the repository, for example:

```powershell
$env:FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH = "$env:USERPROFILE\.firebase-credentials\advanced-home-medical-service-account.json"
```

### Session Trusted Origins

The session-cookie endpoint requires explicit CSRF origin validation.
Configure:

| Variable | Purpose |
|---|---|
| `AUTH_TRUSTED_ORIGINS` | Comma-separated exact HTTPS origins allowed to create/delete the `__session` cookie |
| `AUTH_TRUST_PROXY_HEADERS` | Optional. Set to `true` only when the app is reachable exclusively through the trusted Cloudflare/reverse-proxy path |

Example:

```bash
AUTH_TRUSTED_ORIGINS=https://app.advhomemed.com
AUTH_TRUST_PROXY_HEADERS=true
```

`AUTH_TRUSTED_ORIGINS` does not allow wildcards. Invalid origins or a
missing value in production make `POST /api/auth/session` and
`DELETE /api/auth/session` return a controlled 403. Localhost origins are
accepted only outside production.

> **Note:** There is no `.env.example` file in the repository. Developers
> must infer required environment variables from the code.

### Rate Limiting

The Next.js API routes and selected Cloud Functions use Firestore-backed token
buckets. Defaults are safe for production, but deployment can tune thresholds
with environment variables:

| Variable | Purpose |
|---|---|
| `RATE_LIMIT_LOGIN_LIMIT` / `RATE_LIMIT_LOGIN_WINDOW_SECONDS` | Verified user session-creation bucket |
| `RATE_LIMIT_SESSION_LIMIT` / `RATE_LIMIT_SESSION_WINDOW_SECONDS` | Public IP bucket for session creation |
| `RATE_LIMIT_AI_LIMIT` / `RATE_LIMIT_AI_WINDOW_SECONDS` | ChatGPT, Jarvis, product enrichment, code-fix, and AI callables |
| `RATE_LIMIT_IMPORT_LIMIT` / `RATE_LIMIT_IMPORT_WINDOW_SECONDS` | Import screening, reprocessing, and report analytics rebuilds |
| `RATE_LIMIT_GENERAL_LIMIT` / `RATE_LIMIT_GENERAL_WINDOW_SECONDS` | Ordinary authenticated API and inventory callable traffic |
| `RATE_LIMIT_ADMIN_LIMIT` / `RATE_LIMIT_ADMIN_WINDOW_SECONDS` | User management, role/password changes, reset, clean, and rebuild operations |
| `RATE_LIMIT_TRUST_PROXY_HEADERS` | Optional. Set to `true` only when Cloudflare is the enforced network boundary |

HTTP routes return `429` and `Retry-After` when throttled. Callable Functions
throw `resource-exhausted`. Treat repeated throttling, limiter store failures,
or bursts from a single user/IP as security monitoring events.

## Cloud Functions Secrets

The `askAdminAi` function uses `defineSecret("OPENAI_API_KEY")` to access
the OpenAI API key as a Cloud Functions secret:

```typescript
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

export const askAdminAi = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "1GiB",
    secrets: [OPENAI_API_KEY],
  },
  async (request) => {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    // ...
  }
);
```

Secrets must be configured before deployment:

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

## Pre-Deployment Validation

### Release Readiness Gate

**Script:** `scripts/Get-ReleaseReadiness.ps1`

A PowerShell 7 pre-release gate that:

1. Checks Git repository is present
2. Reports current branch and latest commit
3. Verifies working tree is clean (unless `-AllowDirty`)
4. Checks for untracked, staged, and modified files
5. Runs the full validation pipeline (`Invoke-ProjectValidation.ps1`)

```powershell
# Full release gate (requires clean tree)
.\scripts\Get-ReleaseReadiness.ps1

# Allow dirty tree (for validating uncommitted work)
.\scripts\Get-ReleaseReadiness.ps1 -AllowDirty
```

### Validation Pipeline

**Script:** `scripts/Invoke-ProjectValidation.ps1`

Runs in order, stops on first failure:

1. `npm run lint` — ESLint
2. `npm run typecheck` — TypeScript (`tsc --noEmit`)
3. `npm run build` — Next.js production build
4. Cloud Functions build (`npm run build` in `functions/`)

```powershell
# Full validation
.\scripts\Invoke-ProjectValidation.ps1

# Skip build steps
.\scripts\Invoke-ProjectValidation.ps1 -SkipBuild -SkipFunctions
```

### Project Health Check

**Script:** `scripts/Get-ProjectHealth.ps1`

Read-only snapshot of project health:

- Git branch and working-tree status
- Node/npm/PowerShell versions
- Presence of `package.json`, `functions/package.json`
- Presence of `node_modules`
- Available npm scripts
- Presence of environment files (contents never displayed)
- Presence of Firebase/Next.js config files

```powershell
.\scripts\Get-ProjectHealth.ps1
```

## Deployment Checklist

### Before Deploying

1. **Run release readiness gate:**
   ```powershell
   .\scripts\Get-ReleaseReadiness.ps1
   ```

2. **Verify environment:**
   - Firebase Admin credentials available through ADC or server secrets
   - `AUTH_TRUSTED_ORIGINS` set to the deployed HTTPS app origin
   - `AUTH_TRUST_PROXY_HEADERS=true` only when Cloudflare/reverse-proxy
     headers are trusted at the network boundary
   - Optional `RATE_LIMIT_*` overrides reviewed for the production traffic
     profile
   - `RATE_LIMIT_TRUST_PROXY_HEADERS=true` only when direct origin access is
     blocked and Cloudflare headers are trustworthy
   - `DATABASE_URL` set for PostgreSQL
   - `OPENAI_API_KEY` configured as Cloud Functions secret
   - `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` set

3. **Verify Git state:**
   - Clean working tree
   - On correct branch
   - Latest commit pushed

4. **Build verification:**
   ```bash
   npm run verify    # lint + typecheck + build
   cd functions && npm run build
   ```

### Deploying

1. **Deploy Cloud Functions:**
   ```bash
   firebase deploy --only functions
   ```

2. **Deploy Firestore rules and indexes:**
   ```bash
   firebase deploy --only firestore
   ```

3. **Deploy Storage rules:**
   ```bash
   firebase deploy --only storage
   ```

4. **Deploy Next.js app:**
   ```bash
   npm run build
   # Deploy to your hosting provider (Vercel, Firebase Hosting, etc.)
   ```

### Post-Deployment

1. **Verify functions are running:**
   ```bash
   firebase functions:log
   ```

2. **Test critical paths:**
   - Login
   - Logout
   - Session cookie creation and clearing from the deployed app origin
   - Inventory lookup
   - Import upload
   - Domain workflow (e.g., rental checkout)

3. **Set admin claim (if needed):**
   Call `bootstrapAdminClaim` function for the bootstrap UID

## Prisma Migration

The Prisma schema has one migration:

```
prisma/migrations/20260701133541_init_inventory_schema/
```

To apply migrations:

```bash
npx prisma migrate deploy
```

To generate the Prisma client:

```bash
npx prisma generate
```

> **Note:** The Prisma client is generated into `src/generated/prisma/`.

## Known Deployment Issues

Based on `PRODUCTION_READINESS.md`:

1. **No CI/CD pipeline** — deployment is manual via Firebase CLI
2. **No Docker configuration** for local PostgreSQL development
3. **No Firestore backup strategy** — no scheduled exports configured
4. **No monitoring/alerting** — `console.log` is the sole observability
5. **No security headers** — missing CSP, HSTS, X-Frame-Options
