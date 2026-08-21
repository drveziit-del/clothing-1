<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- codebase-memory-mcp:start -->
# Codebase Knowledge Graph (codebase-memory-mcp)

This project uses codebase-memory-mcp to maintain a knowledge graph of the codebase.
ALWAYS prefer MCP graph tools over grep/glob/file-search for code discovery.

## Priority Order
1. `search_graph` — find functions, classes, routes, variables by pattern
2. `trace_path` — trace who calls a function or what it calls
3. `get_code_snippet` — read specific function/class source code
4. `query_graph` — run Cypher queries for complex patterns
5. `get_architecture` — high-level project summary
<!-- codebase-memory-mcp:end -->

# GERKINK Agent Engineering Directives

## 1. Project Stack & Architecture Overview
* **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 / Vanilla CSS Modules.
* **Database & Auth:** Firebase Firestore + Firebase Admin SDK v13 (HttpOnly Session Cookies).
* **Payment Gateways:** Razorpay (India / INR) & PayPal REST v2 (International / USD).
* **Fulfillment:** Printify REST API v1 background worker orchestrator.

## 2. Non-Negotiable Security Rules
1. **Zero Secret Exposure:** Never commit API keys, service account credentials, or secrets in source code. All secrets must be referenced via `process.env`.
2. **Server-Only Isolation:** All modules accessing `ENCRYPTION_SECRET_KEY`, `RAZORPAY_KEY_SECRET`, `PAYPAL_CLIENT_SECRET`, `PRINTIFY_API_TOKEN`, or `FIREBASE_SERVICE_ACCOUNT` MUST include `import 'server-only';` at the top of the file.
3. **AES-256-GCM Encryption:** Bank details and payout credentials must always be encrypted before writing to Firestore.
4. **Acid Transactions for Referrals:** Referral reward updates ($100 per 10 client purchases) must use `adminDb.runTransaction` to prevent race conditions or double payout counts.
5. **Session Verification:** Every protected API endpoint must verify the `session` cookie server-side using `adminAuth.verifySessionCookie(session, true)`.

## 3. Documentation Reference
For exhaustive system documentation, refer to the files in the `docs/` folder:
* [PRD.md](file:///c:/Users/SOUMALYA/Desktop/clothing%202/docs/PRD.md)
* [TECH_SPECS.md](file:///c:/Users/SOUMALYA/Desktop/clothing%202/docs/TECH_SPECS.md)
* [SITEMAP.md](file:///c:/Users/SOUMALYA/Desktop/clothing%202/docs/SITEMAP.md)
* [ROUTES.md](file:///c:/Users/SOUMALYA/Desktop/clothing%202/docs/ROUTES.md)
* [BRANDING.md](file:///c:/Users/SOUMALYA/Desktop/clothing%202/docs/BRANDING.md)
* [UI_UX.md](file:///c:/Users/SOUMALYA/Desktop/clothing%202/docs/UI_UX.md)
* [CODEBASE_MEMORY.md](file:///c:/Users/SOUMALYA/Desktop/clothing%202/docs/CODEBASE_MEMORY.md)
* [LAUNCH_CHECKLIST.md](file:///c:/Users/SOUMALYA/Desktop/clothing%202/docs/LAUNCH_CHECKLIST.md)
* [ADR.md](file:///c:/Users/SOUMALYA/Desktop/clothing%202/docs/ADR.md)
* [PRODUCTION_CHECKLIST.md](file:///c:/Users/SOUMALYA/Desktop/clothing%202/docs/PRODUCTION_CHECKLIST.md)
