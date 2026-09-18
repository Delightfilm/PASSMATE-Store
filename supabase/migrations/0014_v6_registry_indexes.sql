-- PASSMATE V6 covering indexes flagged by Supabase Performance Advisor.

create index if not exists idx_issuance_artifacts_order_item_id
  on public.issuance_artifacts(order_item_id);

create index if not exists idx_issuance_artifacts_product_version_id
  on public.issuance_artifacts(product_version_id);
