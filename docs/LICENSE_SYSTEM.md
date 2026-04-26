# OWNERP License System

## What This Implements
- Signed license keys (Ed25519 signature verification in Electron main process)
- Activation required before login/use
- Activation key freshness check: key must be generated within the last 1 hour at activation time
- Subscription expiry enforcement:
  - Valid license: full access
  - Expired license: automatic view-only mode
  - Invalid/missing license: locked (activation required)
- Write protection is enforced in main-process DB IPC handlers, not just UI

## Runtime Behavior
- Startup checks runtime license status via `license-get-status`.
- If mode is `locked`, app shows activation screen.
- If mode is `read_only`, app runs with banner and blocks DB writes.
- Write blocking is applied to both:
  - `db-query`
  - `accounting-query`

## Generate Keys (Vendor Side)
1. Create keypair:
   - `node tools/license-generator/license-generator.js keypair --out-dir ./keys`
2. Generate 1-year license key:
   - `node tools/license-generator/license-generator.js generate --private-key ./keys/license-private.pem --customer "ABC Industries" --days 365 --machine-id <machineHash>`
3. Share only generated key with customer.
4. Keep private key secret and offline.

## Interactive Generator EXE
- `dist/license-generator/license-generator.exe` opens in interactive wizard mode when launched directly.
- Wizard actions:
  1. Generate keypair
  2. Generate machine-bound license key
  3. Verify/inspect license key
- Machine ID can be copied from OWNERP license activation screen.

## GUI Generator EXE (OWNERP-style)
- Run desktop UI in development:
  - `npm run license:generator:ui`
- Build installer EXE:
  - `npm run license:generator:ui:dist`
- Output location:
  - `dist/license-generator-ui/`
- UI screens include:
  1. Create Keypair
  2. Generate License (with Machine ID, plan, seats, days, customer)
  3. Verify License (paste key or load file + public key)
- Generator now also writes an activation bundle file beside the raw license file:
  - Example: `license.txt` -> `license.activation.json`
  - This bundle includes the signed license key plus the matching public key PEM.
  - Preferred activation flow: paste the bundle JSON into OWNERP activation.

## Installer Company Details + Activation Logs
- Windows installer now captures company details during setup.
- Installer writes seed file: `%APPDATA%\OWNERP\company-seed.txt`.
- OWNERP imports missing company fields from this seed on first run.
- Every activation attempt is logged in `license_activation_logs` with:
  - status (`success` / `failed`)
  - reason
  - machine id
  - license metadata
  - company details
  - key fingerprint

## Public Key Configuration
- Runtime verifies signatures using public key from:
  1. `OWNERP_LICENSE_PUBLIC_KEY` env var (preferred in production)
  2. `electron-store` key: `license.publicKeyPem`
  3. Fallback embedded public key (development default)

- OWNERP activation can now persist a trusted public key automatically when the operator pastes a valid activation bundle JSON from the generator.
- If you paste only a raw signed key, OWNERP can activate it only when the app already trusts the matching public key.

For production, set your own public key before packaging.

## Machine Binding
- You may generate machine-locked licenses by passing `--machine-id`.
- If `machineId` exists in payload, runtime enforces exact device match.

## Security Notes
- Do not ship private key with OWNERP.
- Rotate keys if private key is exposed.
- For stronger anti-tamper, consider moving license validation into a hardened native addon and adding online revocation checks.
