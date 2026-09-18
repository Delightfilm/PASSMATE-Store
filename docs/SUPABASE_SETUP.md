# PASSMATE Supabase Setup Runbook

## Target

- Organization: **PASSMATE**
- Project: **passmate-prod**
- Region: **ap-northeast-2 (Seoul)**
- Existing DF-AUTOSYNC organization/projects must not be modified.

## Automated sequence after organization exists

1. Detect PASSMATE organization
2. Check Supabase project creation cost
3. Confirm project creation cost
4. Create `passmate-prod` in Seoul
5. Apply migrations in order:
   - `0001_v1_core.sql`
   - `0002_seed_catalog.sql`
6. Run `supabase/tests/v1_smoke.sql`
7. Verify RLS and API visibility
8. Obtain project URL + publishable key
9. Add browser-safe values to Vercel environment variables
10. Connect Storefront catalog reads
11. Redeploy and verify production
12. Update `docs/STATUS.md`, `docs/SESSION_LOG.md`, Issue #2

## Environment variables

Only browser-safe values may use `NEXT_PUBLIC_`.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Server-only credentials must never be committed to GitHub.

## V1 acceptance criteria

- Core tables exist
- RLS enabled on all customer data tables
- Customer cannot promote own role to admin
- Anonymous user can read active product catalog only
- PM-C2 seed exists at 6,900 KRW
- Product version `2027-v1.0` remains draft until launch gate
- Storefront can read product catalog from Supabase
- Vercel build/deploy succeeds
