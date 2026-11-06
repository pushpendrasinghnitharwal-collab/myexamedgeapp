import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'

export function Button({ variant = 'default', size, className = '', children, ...rest }) {
  const cls = ['btn', variant !== 'default' ? variant : '', size || '', className].filter(Boolean).join(' ')
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}

export function Card({ className = '', pad = true, children, ...rest }) {
  return (
    <div className={`card ${pad ? '' : 'pad-0'} ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardHead({ title, sub, right, icon }) {
  return (
    <div className="card-head">
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        {icon && <div className="stat-ico">{icon}</div>}
        <div>
          <div className="card-title">{title}</div>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}

export function Pill({ tone = '', children, className = '' }) {
  return <span className={`pill ${tone} ${className}`}>{children}</span>
}

export function Stat({ icon, value, label, tone }) {
  return (
    <div className="stat">
      {icon && (
        <div className="stat-ico" style={tone ? { background: tone } : undefined}>
          {icon}
        </div>
      )}
      <div>
        <div className="stat-val">{value}</div>
        <div className="stat-lab">{label}</div>
      </div>
    </div>
  )
}

export function Metric({ value, label, tone }) {
  return (
    <div className="metric">
      <div className="metric-val" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="metric-lab">{label}</div>
    </div>
  )
}

export function Bar({ value, tone, thin }) {
  return (
    <div className={`bar ${thin ? 'thin' : ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: tone }} />
    </div>
  )
}

export function EmptyState({ icon = '📭', title, sub, action }) {
  return (
    <div className="empty">
      <div className="ico">{icon}</div>
      <div className="bold" style={{ color: 'var(--text)', fontSize: 15 }}>
        {title}
      </div>
      {sub && <div className="small" style={{ marginTop: 6 }}>{sub}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, children, title, width }) {
  if (!open) return null
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="spread" style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 19 }}>{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Toasts ──────────────────────────────────────────────────────
const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((msg, icon = '✅') => {
    const id = Math.random().toString(36).slice(2)
    setItems((p) => [...p, { id, msg, icon }])
    setTimeout(() => setItems((p) => p.filter((i) => i.id !== id)), 2600)
  }, [])
  const value = useMemo(() => ({ push }), [push])
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-wrap">
        {items.map((i) => (
          <div className="toast" key={i.id}>
            <span>{i.icon}</span>
            <span>{i.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const v = useContext(ToastCtx)
  return v?.push || (() => {})
}

export function SegmentedTabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <div key={t.value} className={`tab ${value === t.value ? 'on' : ''}`} onClick={() => onChange(t.value)}>
          {t.label}
        </div>
      ))}
    </div>
  )
}

export function Sparkline({ points, height = 40, color = 'var(--accent)', fill = true }) {
  if (!points || points.length < 2) return null
  const w = 100
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const step = w / (points.length - 1)
  const coords = points.map((p, i) => [i * step, height - ((p - min) / range) * (height - 6) - 3])
  const path = coords.map((c, i) => `${i ? 'L' : 'M'}${c[0].toFixed(2)},${c[1].toFixed(2)}`).join(' ')
  const area = `${path} L${w},${height} L0,${height} Z`
  const gid = 'sp' + Math.random().toString(36).slice(2, 7)
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  )
}
