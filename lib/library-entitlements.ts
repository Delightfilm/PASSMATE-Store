export type LibraryOrderState = {
  id: string;
  status: string;
  fulfillment_status: string;
};

export type LibraryGrant = {
  id: string;
  status: string;
  granted_at: string;
  product_id: string;
  product_version_id: string | null;
  source_order_id: string | null;
};

export function isGrantDownloadReady(
  grant: LibraryGrant,
  orders: Readonly<Record<string, LibraryOrderState>>
) {
  if (!grant.source_order_id) return false;

  const order = orders[grant.source_order_id];
  return order?.status === "paid" && order.fulfillment_status === "ready";
}

function grantedAtTimestamp(grant: LibraryGrant) {
  const timestamp = Date.parse(grant.granted_at);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function shouldReplaceGrant(
  candidate: LibraryGrant,
  current: LibraryGrant,
  orders: Readonly<Record<string, LibraryOrderState>>
) {
  const candidateReady = isGrantDownloadReady(candidate, orders);
  const currentReady = isGrantDownloadReady(current, orders);

  if (candidateReady !== currentReady) return candidateReady;

  const candidateGrantedAt = grantedAtTimestamp(candidate);
  const currentGrantedAt = grantedAtTimestamp(current);
  if (candidateGrantedAt !== currentGrantedAt) {
    return candidateGrantedAt > currentGrantedAt;
  }

  return candidate.id > current.id;
}

export function selectPreferredLibraryGrants<T extends LibraryGrant>(
  grants: readonly T[],
  orders: Readonly<Record<string, LibraryOrderState>>
): T[] {
  const selected = new Map<string, T>();

  for (const grant of grants) {
    if (grant.status !== "active") continue;

    const key = JSON.stringify([
      grant.product_id,
      grant.product_version_id,
    ]);
    const current = selected.get(key);

    if (!current || shouldReplaceGrant(grant, current, orders)) {
      selected.set(key, grant);
    }
  }

  return [...selected.values()].sort((left, right) => {
    const timestampDifference =
      grantedAtTimestamp(right) - grantedAtTimestamp(left);
    return timestampDifference || right.id.localeCompare(left.id);
  });
}
