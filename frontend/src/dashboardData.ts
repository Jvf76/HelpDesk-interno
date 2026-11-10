export type StateCount = { state: string; count: number };
/** IN_SESSION and ERROR still have a recent heartbeat in the existing API.
 * DISABLED is offline in the inventory's `online` contract, even with a heartbeat.
 * Session count is the server's count of computers with an ACTIVE session, not
 * an inferred count from pending requests or the five visible inventory rows.
 */
export function dashboardCounts(counts: StateCount[]) {
  const values = Object.fromEntries(counts.map(row => [row.state, Number(row.count)]));
  return {
    online: (values.ONLINE || 0) + (values.IN_SESSION || 0) + (values.ERROR || 0),
    offline: (values.OFFLINE || 0) + (values.DISABLED || 0),
    active: values.IN_SESSION || 0,
  };
}
export function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—";
}
export function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${formatNumber(value)}%` : "Sem medição";
}
