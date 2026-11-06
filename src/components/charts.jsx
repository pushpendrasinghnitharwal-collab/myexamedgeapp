import React from 'react'

// ── Donut / score ring ─────────────────────────────────────────
export function Ring({ value, max = 100, size = 170, stroke = 14, label, sub, color = 'url(#ringGrad)' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pctv = Math.max(0, Math.min(1, value / max))
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366F1" />
            <stop offset="0.5" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pctv)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="center">
        <div className="big-score">{label}</div>
        {sub && <div className="tiny muted">{sub}</div>}
      </div>
    </div>
  )
}

// ── Radar chart (subject accuracy) ──────────────────────────────
export function Radar({ data, size = 300 }) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 38
  const n = data.length
  if (!n) return null
  const pt = (i, v) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    const rr = r * Math.max(0.06, v)
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]
  }
  const poly = data.map((d, i) => pt(i, d.value).join(',')).join(' ')
  return (
    <svg width={size} height={size} style={{ maxWidth: '100%' }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={data.map((_, i) => pt(i, f).join(',')).join(' ')}
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, 1)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="1" />
      })}
      <polygon points={poly} fill="rgba(99,102,241,0.28)" stroke="#8b5cf6" strokeWidth="2" />
      {data.map((d, i) => {
        const [x, y] = pt(i, d.value)
        return <circle key={i} cx={x} cy={y} r="3.5" fill="#22d3ee" />
      })}
      {data.map((d, i) => {
        const [x, y] = pt(i, 1.22)
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10.5"
            fill="var(--muted)"
            fontWeight="600"
          >
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}

// ── Line chart ─────────────────────────────────────────────────
export function LineChart({ series, labels, height = 190, yMax, yMin = 0 }) {
  const w = 640
  const h = height
  const padL = 34
  const padB = 24
  const padT = 12
  const max = yMax ?? Math.max(...series.flatMap((s) => s.values)) * 1.15
  const min = yMin
  const range = max - min || 1
  const x = (i) => padL + (i * (w - padL - 10)) / Math.max(1, labels.length - 1)
  const y = (v) => padT + (h - padT - padB) * (1 - (v - min) / range)

  const colors = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981']

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={padL}
            x2={w - 10}
            y1={padT + (h - padT - padB) * f}
            y2={padT + (h - padT - padB) * f}
            stroke="var(--line)"
            strokeWidth="1"
          />
          <text x={4} y={padT + (h - padT - padB) * f + 4} fontSize="10" fill="var(--muted)">
            {Math.round(max - range * f)}
          </text>
        </g>
      ))}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={h - 6} fontSize="10" fill="var(--muted)" textAnchor="middle">
          {l}
        </text>
      ))}
      {series.map((s, si) => {
        const path = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
        return (
          <g key={s.name}>
            <path d={path} fill="none" stroke={colors[si % colors.length]} strokeWidth="2.4" strokeLinecap="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={colors[si % colors.length]}>
                <title>{`${s.name}: ${v}`}</title>
              </circle>
            ))}
          </g>
        )
      })}
      {series.map((s, si) => (
        <g key={s.name + '-lg'}>
          <rect x={padL + si * 96} y={4} width="9" height="9" rx="2.5" fill={colors[si % colors.length]} />
          <text x={padL + si * 96 + 13} y={12} fontSize="10.5" fill="var(--muted)" fontWeight="600">
            {s.name}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── Horizontal bar list ────────────────────────────────────────
export function BarList({ items, max }) {
  const peak = max ?? Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="stack sm">
      {items.map((it) => (
        <div key={it.label}>
          <div className="spread" style={{ marginBottom: 5 }}>
            <span className="small bold">{it.label}</span>
            <span className="tiny muted num">{it.display ?? `${Math.round(it.value * 100)}%`}</span>
          </div>
          <div className="bar thin">
            <i style={{ width: `${(it.value / peak) * 100}%`, background: it.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Activity heatmap ───────────────────────────────────────────
export function Heatmap({ values = [], weeks = 15 }) {
  const cells = []
  for (let i = 0; i < weeks * 7; i++) {
    const v = values[values.length - weeks * 7 + i] || 0
    const level = v === 0 ? 0 : v < 3 ? 1 : v < 6 ? 2 : v < 10 ? 3 : 4
    cells.push(<i key={i} data-l={level} title={`${v} questions`} />)
  }
  return <div className="heat">{cells}</div>
}

// ── Donut segments ─────────────────────────────────────────────
export function Donut({ segments, size = 150, thickness = 22, centerLabel, centerSub }) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let offset = 0
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        {segments.map((s) => {
          const len = (s.value / total) * c
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          )
          offset += len
          return el
        })}
      </svg>
      <div className="center">
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{centerLabel}</div>
        <div className="tiny muted">{centerSub}</div>
      </div>
    </div>
  )
}
