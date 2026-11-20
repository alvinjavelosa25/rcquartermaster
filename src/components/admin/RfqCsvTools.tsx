'use client'

import { useState } from 'react'

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 4,
  padding: 16,
  marginBottom: 16,
  background: 'var(--theme-elevation-50)',
}

/** Admin tool shown above the RFQ list: filtered CSV export. */
export function RfqCsvTools() {
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')

  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (q.trim()) params.set('q', q.trim())
  const href = `/api/export/rfqs${params.size ? `?${params.toString()}` : ''}`

  return (
    <details style={box}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Export RFQs to CSV</summary>
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
        <label>
          Status
          <br />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="new">New</option>
            <option value="in_progress">In progress</option>
            <option value="quoted">Quoted</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label>
          Submitted from
          <br />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Submitted to
          <br />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Text (reference, name, organisation, email, SKU)
          <br />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <a href={href} download className="btn btn--style-primary btn--size-small">
          Download CSV
        </a>
      </div>
    </details>
  )
}
