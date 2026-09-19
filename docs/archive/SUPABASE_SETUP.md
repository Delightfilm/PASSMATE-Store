# PASSMATE Supabase Setup Runbook

## Current Production Candidate

- Organization: **PASSMATE**
- Project ref: **fmecqeadghrdisirucqm**
- Dashboard project name: **Delightfilm's Project**
- Region: **ap-northeast-1 (Tokyo)**
- Status: **ACTIVE_HEALTHY**
- Existing DF-AUTOSYNC organization/projects must not be modified.

> Original target was Seoul (ap-northeast-2), but the user-created PASSMATE project is currently Tokyo. Do not create a second project automatically; migrate only if region change is explicitly chosen.

## Live Setup Status

1. [x] PASSMATE project direct access
2. [x] migrations 0001~0004 confirmed
3. [x] PM-C2 seed confirmed
4. [x] V1 smoke test
5. [x] runtime order/issuance verification
6. [x] security hardening migration
7. [x] Supabase Security Advisor: 0 findings
8. [x] project URL + publishable key obtained
9. [ ] Add browser-safe values to Vercel environment variables
10. [ ] Connect Storefront catalog reads
11. [ ] Redeploy and verify production
12. [ ] Auth-user RLS integration test

## Environment variables

Only browser-safe values may use `NEXT_PUBLIC_`.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Server-only credentials must never be committed to GitHub.

## V1 acceptance criteria

- [x] Core tables exist
- [x] RLS enabled on all customer data tables
- [x] Customer cannot promote own role to admin
- [x] Worker RPC restricted to service_role
- [x] Supabase Security Advisor has no security findings
- [x] PM-C2 seed exists at 6,900 KRW
- [x] Product version `2027-v1.0` remains draft until launch gate
- [ ] Anonymous Storefront can read active product catalog through production deployment
- [ ] Auth user own-row RLS integration test
- [ ] Vercel build/deploy succeeds with Supabase env
