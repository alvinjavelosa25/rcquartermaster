'use client'

import { useState } from 'react'

interface Report {
  dryRun: boolean
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: { row: number; sku?: string; message: string }[]
  fatal?: string
}

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 4,
  padding: 16,
  marginBottom: 16,
  background: 'var(--theme-elevation-50)',
}

/** Admin tools shown above the product list: CSV export, and CSV import with a dry-run option. */
export function ProductCsvTools() {
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [message, setMessage] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    if (!(data.get('file') instanceof File) || (data.get('file') as File).size === 0) {
      setMessage('Choose a CSV file first.')
      return
    }
    setBusy(true)
    setMessage('')
    setReport(null)
    try {
      const res = await fetch('/api/import/products', {
        method: 'POST',
        body: data,
        credentials: 'same-origin',
      })
      const json = (await res.json()) as Report & { error?: string }
      if (!res.ok) setMessage(json.error ?? 'Import failed.')
      else setReport(json)
    } catch {
      setMessage('Import failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details style={box}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>CSV import and export</summary>
      <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        <p style={{ margin: 0 }}>
          <a href="/api/export/products" download>
            Export all products (CSV)
          </a>
          {' · '}
          <a href="/api/import/products?template=1" download>
            Download import template
          </a>
        </p>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
          <label>
            CSV file <input type="file" name="file" accept=".csv,text/csv" />
          </label>
          <label>
            <input type="checkbox" name="dryRun" value="true" defaultChecked /> Dry run (validate
            only, change nothing)
          </label>
          <label>
            <input type="checkbox" name="publish" value="true" /> Publish imported products (default
            is Draft)
          </label>
          <div>
            <button
              type="submit"
              disabled={busy}
              className="btn btn--style-primary btn--size-small"
            >
              {busy ? 'Working…' : 'Run import'}
            </button>
          </div>
        </form>
        <div role="status" aria-live="polite">
          {message && <p style={{ color: 'var(--theme-error-500)' }}>{message}</p>}
          {report && (
            <div>
              <p>
                <strong>{report.dryRun ? 'Dry run result' : 'Import result'}:</strong>{' '}
                {report.total} rows, {report.created} to create/created, {report.updated} to
                update/updated, {report.skipped} skipped, {report.failed} failed.
              </p>
              {report.fatal && <p style={{ color: 'var(--theme-error-500)' }}>{report.fatal}</p>}
              {report.errors.length > 0 && (
                <ul>
                  {report.errors.slice(0, 50).map((er, i) => (
                    <li key={i}>
                      Row {er.row}
                      {er.sku ? ` (${er.sku})` : ''}: {er.message}
                    </li>
                  ))}
                  {report.errors.length > 50 && <li>…and {report.errors.length - 50} more.</li>}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </details>
  )
}
