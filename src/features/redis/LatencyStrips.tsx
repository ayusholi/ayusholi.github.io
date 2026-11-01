import type { RedisState, RequestStatus, RequestTrace } from "./redis-types";

const STATUS: Record<RequestStatus, string> = {
  hit: "● hit", miss: "○ miss", stale: "◐ stale", bypass: "△ bypass", failed: "✕ failed",
};
const SCALE = 200;   // milliseconds across the full width

const Row = ({ r, live }: { r: RequestTrace; live?: boolean }) => (
  <div className={`fall__row${live ? " is-live" : ""}`}>
    <span>{live ? "▸ live" : r.status && STATUS[r.status]}</span>
    <span className="fall__bar">
      {r.segments.map((seg, i) => <i key={i} className={`seg-${seg.node}`} style={{ width: `${(seg.ms / SCALE) * 100}%` }} />)}
    </span>
    <span className="fall__ms">{r.elapsed} ms</span>
  </div>
);

// One row per request, drawn to scale.
export const LatencyStrips = ({ state, limit = 5, id }: { state: RedisState; limit?: number; id?: string }) => {
  const past = state.history.slice(-limit).reverse();
  const live = state.req && state.req.segments.length ? state.req : null;
  return (
    <>
      <div className="fall" id={id}>
        {live && <Row r={live} live />}
        {past.map((r) => <Row key={r.id} r={r} />)}
        {!live && !past.length && <p className="fall__empty">No requests yet. Each one is drawn here to scale.</p>}
      </div>
      <div className="fall__key">
        <span className="k-network">network</span><span className="k-redis">Redis</span><span className="k-postgres">Postgres</span><span className="k-timeout">timeout</span>
      </div>
    </>
  );
};
