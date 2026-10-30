// Transport-independent policy shared by the embedded viewer and future web viewer.
// Uses the existing Mesh desktop JPEG/scale/frame-interval command, not a new codec.
(function (root) {
  const profiles = Object.freeze({
    economy: Object.freeze({ label: 'Economia', jpeg: 30, scale: 640, interval: 200 }),
    balanced: Object.freeze({ label: 'Equilibrada', jpeg: 50, scale: 1024, interval: 100 }),
    clarity: Object.freeze({ label: 'Nitidez', jpeg: 75, scale: 1024, interval: 100 }),
  });
  function create({ apply, now = () => performance.now() }) {
    let mode = 'auto', current = 'balanced', measuredAt = null, rtt = null;
    let poor = 0, good = 0, lastChange = -Infinity;
    function change(name) {
      if (current === name) return;
      current = name; lastChange = now(); poor = good = 0;
      apply(profiles[name]);
    }
    return {
      get profile() { return profiles[current]; },
      select(value) {
        if (value !== 'auto' && !Object.hasOwn(profiles, value)) throw new Error('Perfil inválido');
        mode = value; poor = good = 0;
        change(value === 'auto' ? 'balanced' : value);
      },
      sample(value, bufferedBytes = 0, pendingTiles = 0) {
        if (!Number.isFinite(value) || value < 0 || value > 60000) return;
        rtt = Math.round(value); measuredAt = now();
        if (mode !== 'auto') return;
        const congested = rtt >= 250 || bufferedBytes >= 65536 || pendingTiles >= 8;
        poor = congested ? poor + 1 : 0;
        good = !congested && rtt < 120 && bufferedBytes < 8192 && pendingTiles < 2 ? good + 1 : 0;
        if (now() - lastChange < 20000) return;
        if (poor >= 2) change('economy');
        else if (good >= 3) change('balanced');
      },
      status() {
        const fresh = measuredAt !== null && now() - measuredAt < 25000;
        return `RTT do transporte: ${fresh ? rtt + ' ms' : 'sem medição recente'} • Qualidade: ${profiles[current].label}${mode === 'auto' ? ' (automática)' : ''}`;
      },
    };
  }
  root.UaiQuality = Object.freeze({ profiles, create });
})(globalThis);
