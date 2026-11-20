'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { buttonClass, formatBytes, inputClass } from '@/components/ui'
import { trackEvent } from '@/lib/analytics'
import { MAX_QUANTITY } from '@/lib/constants'
import { ALLOWED_ATTACHMENTS, validateBatch, validateDeclaredFile } from '@/lib/rfq/attachments'
import { rfqSubmissionSchema, type RfqSubmission, type RfqSubmissionInput } from '@/lib/rfq/schema'
import { useRfqList } from './use-rfq-list'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
  }
}

export interface RfqFormProps {
  turnstileSiteKey: string
  limits: { maxFiles: number; maxFileMb: number; maxTotalMb: number }
  contact: { phone: string; email: string }
  prefillDescription?: string
}

interface UploadedFile {
  id: string
  name: string
  size: number
  contentType: string
  key?: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  error?: string
  file?: File
}

const FIELD_LABELS: Record<string, string> = {
  buyerName: 'Name',
  organisation: 'Organisation',
  email: 'Email',
  phone: 'Phone',
  neededBy: 'Needed by',
  generalDescription: 'Request description',
  privacyAcknowledged: 'Privacy acknowledgement',
  turnstileToken: 'Verification check',
  items: 'Requested items',
  attachments: 'Attachments',
}

const DRAFT_KEY = 'rcq.rfq-form-draft'
const DRAFT_FIELDS = [
  'buyerName',
  'organisation',
  'facility',
  'buyerRole',
  'email',
  'phone',
  'neededBy',
  'solicitationNumber',
  'deliveryDetails',
  'specialInstructions',
  'generalDescription',
] as const

const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {label}{' '}
        <span className="font-normal text-muted">{required ? '(required)' : '(optional)'}</span>
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 font-semibold text-danger">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      )}
    </div>
  )
}

export function RfqForm({ turnstileSiteKey, limits, contact, prefillDescription }: RfqFormProps) {
  const router = useRouter()
  const { items, actions } = useRfqList()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [fileMessage, setFileMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [turnstileFailed, setTurnstileFailed] = useState(false)
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({})
  const [customName, setCustomName] = useState('')
  const [customQty, setCustomQty] = useState('1')
  const [customError, setCustomError] = useState('')
  const [listMessage, setListMessage] = useState('')
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [minDate, setMinDate] = useState('')
  const summaryRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)
  const started = useRef(false)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    reset,
    formState: { errors, submitCount },
  } = useForm<RfqSubmissionInput, unknown, RfqSubmission>({
    resolver: zodResolver(rfqSubmissionSchema),
    defaultValues: {
      buyerName: '',
      organisation: '',
      facility: '',
      buyerRole: '',
      email: '',
      phone: '',
      neededBy: '',
      solicitationNumber: '',
      deliveryDetails: '',
      specialInstructions: '',
      generalDescription: prefillDescription ?? '',
      items: [],
      attachments: [],
      privacyAcknowledged: false as unknown as true,
      turnstileToken: '',
      idempotencyKey: '',
      website: '',
    },
    shouldFocusError: false,
  })

  const attachmentRefs = useMemo(
    () =>
      files
        .filter((f) => f.status === 'done' && f.key)
        .map((f) => ({ key: f.key!, name: f.name, size: f.size, contentType: f.contentType })),
    [files],
  )
  const uploading = files.some((f) => f.status === 'uploading')

  // Keep list-derived values inside the form so the shared Zod schema validates everything.
  useEffect(() => {
    setValue(
      'items',
      items.map((i) => ({
        sku: i.custom ? '' : i.sku,
        name: i.name,
        quantity: i.quantity,
        unitOfMeasure: i.unitOfMeasure,
      })),
      { shouldValidate: submitCount > 0 },
    )
  }, [items, setValue, submitCount])
  useEffect(() => {
    setValue('attachments', attachmentRefs, { shouldValidate: submitCount > 0 })
  }, [attachmentRefs, setValue, submitCount])
  useEffect(() => {
    setValue('idempotencyKey', idempotencyKey)
  }, [idempotencyKey, setValue])
  useEffect(() => setMinDate(todayLocal()), [])

  // Restore and persist the buyer's entries for this browser session (WCAG 3.3.7 redundant entry).
  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Record<
        string,
        string
      > | null
      if (saved)
        for (const f of DRAFT_FIELDS)
          if (typeof saved[f] === 'string' && saved[f]) setValue(f, saved[f])
    } catch {
      // ignore corrupt draft
    }
    // eslint-disable-next-line react-hooks/incompatible-library
    const sub = watch((values) => {
      try {
        const out: Record<string, string> = {}
        for (const f of DRAFT_FIELDS) out[f] = (values[f] as string) ?? ''
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(out))
      } catch {
        // storage unavailable
      }
    })
    return () => sub.unsubscribe()
  }, [setValue, watch])

  /* ---- Turnstile ---------------------------------------------------------------------------- */
  const renderTurnstile = useCallback(() => {
    if (!window.turnstile || !widgetRef.current || widgetId.current) return
    widgetId.current = window.turnstile.render(widgetRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => {
        setValue('turnstileToken', token, { shouldValidate: submitCount > 0 })
        setTurnstileFailed(false)
      },
      'expired-callback': () => setValue('turnstileToken', ''),
      'error-callback': () => {
        setValue('turnstileToken', '')
        setTurnstileFailed(true)
      },
    })
  }, [setValue, submitCount, turnstileSiteKey])
  useEffect(() => {
    renderTurnstile()
  }, [renderTurnstile])
  const resetTurnstile = () => {
    setValue('turnstileToken', '')
    try {
      window.turnstile?.reset(widgetId.current)
    } catch {
      // ignore
    }
  }

  /* ---- Error summary focus ------------------------------------------------------------------ */
  const errorList = Object.entries(errors).flatMap(([key, value]) => {
    const message = (value as { message?: string } | undefined)?.message
    if (key === 'items') return [{ key, message: 'Check the quantities in your list.' }]
    if (key === 'attachments')
      return [
        { key, message: (value as { message?: string })?.message ?? 'Check your attachments.' },
      ]
    return message ? [{ key, message }] : []
  })
  useEffect(() => {
    if (submitCount > 0 && errorList.length > 0) summaryRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount])
  useEffect(() => {
    if (serverError) summaryRef.current?.focus()
  }, [serverError])

  function focusField(key: string) {
    const id =
      key === 'items'
        ? 'rfq-list-heading'
        : key === 'attachments'
          ? 'attachments-input'
          : key === 'turnstileToken'
            ? 'turnstile-box'
            : `field-${key}`
    const el = document.getElementById(id)
    el?.scrollIntoView({ block: 'center' })
    el?.focus()
  }

  /* ---- List editing ------------------------------------------------------------------------- */
  function onQuantityChange(sku: string, name: string, raw: string) {
    setQtyDrafts((d) => ({ ...d, [sku]: raw }))
    if (/^\d+$/.test(raw)) {
      const n = Number(raw)
      if (n >= 1 && n <= MAX_QUANTITY) {
        actions.setQuantity(sku, n)
        return
      }
    }
    setListMessage(
      `Quantity for ${name} must be a whole number between 1 and ${MAX_QUANTITY.toLocaleString('en-US')}.`,
    )
  }
  function commitQuantity(sku: string) {
    setQtyDrafts((d) => {
      const next = { ...d }
      delete next[sku]
      return next
    })
    setListMessage('')
  }
  function addCustom() {
    const name = customName.trim()
    const qty = Number(customQty)
    if (!name) return setCustomError('Describe the item you need.')
    if (!/^\d+$/.test(customQty) || qty < 1 || qty > MAX_QUANTITY)
      return setCustomError('Enter a whole number quantity of at least 1.')
    const result = actions.addCustom(name, qty)
    if (result.status === 'full') return setCustomError('Your list is full.')
    setCustomError('')
    setCustomName('')
    setCustomQty('1')
    setListMessage(`${name} added to your request.`)
  }

  /* ---- Attachments -------------------------------------------------------------------------- */
  const maxFileBytes = limits.maxFileMb * 1024 * 1024
  const batchLimits = {
    maxFiles: limits.maxFiles,
    maxFileBytes,
    maxTotalBytes: limits.maxTotalMb * 1024 * 1024,
  }

  function uploadOne(entry: UploadedFile, file: File) {
    const patch = (p: Partial<UploadedFile>) =>
      setFiles((fs) => fs.map((f) => (f.id === entry.id ? { ...f, ...p } : f)))
    ;(async () => {
      try {
        const res = await fetch('/api/rfq/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, size: file.size, contentType: file.type }),
        })
        const json = (await res.json()) as {
          key?: string
          error?: string
          target?: { url: string; headers: Record<string, string> }
        }
        if (!res.ok || !json.key || !json.target)
          throw new Error(json.error ?? 'Upload could not be started.')
        const target = json.target
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', target.url)
          for (const [k, v] of Object.entries(target.headers)) xhr.setRequestHeader(k, v)
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) patch({ progress: Math.round((e.loaded / e.total) * 100) })
          }
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error('The upload failed. Please try again.'))
          xhr.onerror = () => reject(new Error('Network error during upload. Please try again.'))
          xhr.send(file)
        })
        patch({ key: json.key, status: 'done', progress: 100 })
        setFileMessage(`${file.name} uploaded.`)
      } catch (e) {
        patch({ status: 'error', error: (e as Error).message })
        setFileMessage(`${file.name} could not be uploaded.`)
      }
    })()
  }

  function onFilesChosen(list: FileList | null) {
    if (!list || list.length === 0) return
    const chosen = Array.from(list)
    const problems: string[] = []
    const accepted: File[] = []
    const existingSizes = files.filter((f) => f.status !== 'error').map((f) => f.size)
    for (const file of chosen) {
      const check = validateDeclaredFile(
        { filename: file.name, size: file.size, contentType: file.type },
        batchLimits,
      )
      if (!check.ok) {
        problems.push(check.error)
        continue
      }
      const batch = validateBatch(
        [...existingSizes, ...accepted.map((a) => a.size), file.size],
        batchLimits,
      )
      if (batch) {
        problems.push(batch)
        continue
      }
      accepted.push(file)
    }
    const entries: UploadedFile[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      contentType: file.type,
      progress: 0,
      status: 'uploading',
      file,
    }))
    setFiles((fs) => [...fs, ...entries])
    setFileMessage(problems.join(' '))
    entries.forEach((entry, i) => uploadOne(entry, accepted[i]!))
    const input = document.getElementById('attachments-input') as HTMLInputElement | null
    if (input) input.value = ''
  }

  function retry(entry: UploadedFile) {
    if (!entry.file) return
    setFiles((fs) =>
      fs.map((f) =>
        f.id === entry.id ? { ...f, status: 'uploading', progress: 0, error: undefined } : f,
      ),
    )
    uploadOne(entry, entry.file)
  }
  const removeFile = (id: string) => {
    const f = files.find((x) => x.id === id)
    setFiles((fs) => fs.filter((x) => x.id !== id))
    setFileMessage(`${f?.name ?? 'File'} removed.`)
  }

  /* ---- Submit ------------------------------------------------------------------------------- */
  const onValid = async (values: RfqSubmission) => {
    setServerError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, idempotencyKey }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        reference?: string
        error?: string
        fields?: Record<string, string>
      }
      if (res.ok && json.reference) {
        trackEvent('rfq_submit', {
          items: values.items.length,
          attachments: values.attachments.length,
          general: values.items.length === 0,
        })
        try {
          window.sessionStorage.removeItem(DRAFT_KEY)
        } catch {
          // ignore
        }
        actions.clear()
        reset()
        router.push(`/rfq/thank-you?ref=${encodeURIComponent(json.reference)}`)
        return
      }
      if (json.fields) {
        for (const [field, message] of Object.entries(json.fields))
          setError(field as keyof RfqSubmissionInput, { type: 'server', message })
      }
      setServerError(json.error ?? 'We could not submit your request. Please try again.')
      resetTurnstile()
    } catch {
      setServerError(
        `We could not reach the server. Your entries have been kept. Please try again, or contact us${contact.phone ? ` on ${contact.phone}` : ''}.`,
      )
      resetTurnstile()
    } finally {
      setSubmitting(false)
    }
  }

  const describedBy = (id: string, hint: boolean, err: unknown) =>
    [hint ? `${id}-hint` : '', err ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  const e = (name: keyof RfqSubmissionInput) =>
    (errors[name] as { message?: string } | undefined)?.message
  const generalRequired = items.length === 0

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onValid)}
      onFocusCapture={() => {
        if (!started.current) {
          started.current = true
          trackEvent('rfq_start', { items: items.length })
        }
      }}
      className="space-y-10"
    >
      {(errorList.length > 0 || serverError) && submitCount > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border-2 border-danger bg-danger-bg p-4"
          data-testid="error-summary"
        >
          <h2 className="text-lg font-bold text-danger">There is a problem</h2>
          {serverError && <p className="mt-1">{serverError}</p>}
          {errorList.length > 0 && (
            <ul className="mt-2 list-disc pl-6">
              {errorList.map((er) => (
                <li key={er.key}>
                  <a
                    href={`#field-${er.key}`}
                    onClick={(ev) => {
                      ev.preventDefault()
                      focusField(er.key)
                    }}
                  >
                    {FIELD_LABELS[er.key] ? `${FIELD_LABELS[er.key]}: ` : ''}
                    {er.message}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section aria-labelledby="rfq-list-heading">
        <h2 id="rfq-list-heading" tabIndex={-1} className="text-2xl font-bold outline-none">
          Items in your request
        </h2>
        <p role="status" aria-live="polite" className="sr-only">
          {listMessage}
        </p>
        {items.length === 0 ? (
          <p className="mt-3">
            Your list is empty. <Link href="/categories">Browse products</Link> to add items, add an
            item below, or describe what you need in the request description.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <caption className="sr-only">Items in your RFQ list</caption>
              <thead>
                <tr className="border-b-2 border-line">
                  <th scope="col" className="py-2 pr-4">
                    SKU
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Item
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Quantity
                  </th>
                  <th scope="col" className="py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const draft = qtyDrafts[i.sku]
                  const invalid =
                    draft !== undefined &&
                    !(/^\d+$/.test(draft) && Number(draft) >= 1 && Number(draft) <= MAX_QUANTITY)
                  return (
                    <tr
                      key={i.sku}
                      className="border-b border-line align-top"
                      data-testid="rfq-line"
                    >
                      <td className="py-3 pr-4 font-mono">
                        {i.custom ? 'Not in catalogue' : i.sku}
                      </td>
                      <td className="py-3 pr-4">
                        {i.slug ? <Link href={`/products/${i.slug}`}>{i.name}</Link> : i.name}
                      </td>
                      <td className="py-3 pr-4">
                        <label htmlFor={`qty-${i.sku}`} className="sr-only">
                          Quantity for {i.name}
                        </label>
                        <input
                          id={`qty-${i.sku}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={draft ?? String(i.quantity)}
                          onChange={(ev) => onQuantityChange(i.sku, i.name, ev.target.value)}
                          onBlur={() => commitQuantity(i.sku)}
                          aria-invalid={invalid || undefined}
                          aria-describedby={invalid ? `qty-${i.sku}-error` : undefined}
                          className={`${inputClass} w-28`}
                        />
                        {invalid && (
                          <p
                            id={`qty-${i.sku}-error`}
                            className="mt-1 text-sm font-semibold text-danger"
                          >
                            Enter a whole number from 1 to {MAX_QUANTITY.toLocaleString('en-US')}.
                          </p>
                        )}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => {
                            actions.remove(i.sku)
                            setListMessage(`${i.name} removed from your request.`)
                          }}
                          className={buttonClass('quiet')}
                        >
                          Remove<span className="sr-only"> {i.name}</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <fieldset className="mt-6 rounded-lg border border-line p-4">
          <legend className="px-2 font-bold">Add an item that is not in the catalogue</legend>
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
            <div>
              <label htmlFor="custom-name" className="block font-semibold">
                Item description
              </label>
              <input
                id="custom-name"
                value={customName}
                onChange={(ev) => setCustomName(ev.target.value)}
                maxLength={300}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label htmlFor="custom-qty" className="block font-semibold">
                Quantity
              </label>
              <input
                id="custom-qty"
                inputMode="numeric"
                value={customQty}
                onChange={(ev) => setCustomQty(ev.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
            <button type="button" onClick={addCustom} className={buttonClass('secondary')}>
              Add item
            </button>
          </div>
          {customError && (
            <p className="mt-2 font-semibold text-danger" role="alert">
              {customError}
            </p>
          )}
        </fieldset>
      </section>

      <fieldset className="space-y-5">
        <legend className="text-2xl font-bold">Your details</legend>
        <Field id="field-buyerName" label="Name" required error={e('buyerName')}>
          <input
            id="field-buyerName"
            autoComplete="name"
            aria-invalid={!!e('buyerName') || undefined}
            aria-describedby={describedBy('field-buyerName', false, e('buyerName'))}
            className={`${inputClass} mt-1`}
            {...register('buyerName')}
          />
        </Field>
        <Field
          id="field-organisation"
          label="Organisation"
          required
          hint="For example the medical centre, agency or company name."
          error={e('organisation')}
        >
          <input
            id="field-organisation"
            autoComplete="organization"
            aria-invalid={!!e('organisation') || undefined}
            aria-describedby={describedBy('field-organisation', true, e('organisation'))}
            className={`${inputClass} mt-1`}
            {...register('organisation')}
          />
        </Field>
        <Field id="field-facility" label="Facility or department" error={e('facility')}>
          <input
            id="field-facility"
            autoComplete="off"
            className={`${inputClass} mt-1`}
            {...register('facility')}
          />
        </Field>
        <Field id="field-buyerRole" label="Your role" error={e('buyerRole')}>
          <input
            id="field-buyerRole"
            autoComplete="organization-title"
            className={`${inputClass} mt-1`}
            {...register('buyerRole')}
          />
        </Field>
        <Field id="field-email" label="Email" required error={e('email')}>
          <input
            id="field-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!e('email') || undefined}
            aria-describedby={describedBy('field-email', false, e('email'))}
            className={`${inputClass} mt-1`}
            {...register('email')}
          />
        </Field>
        <Field
          id="field-phone"
          label="Phone"
          required
          hint="Include area code, for example 301-555-0100."
          error={e('phone')}
        >
          <input
            id="field-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={!!e('phone') || undefined}
            aria-describedby={describedBy('field-phone', true, e('phone'))}
            className={`${inputClass} mt-1`}
            {...register('phone')}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-2xl font-bold">Request details</legend>
        <Field
          id="field-generalDescription"
          label="Request description"
          required={generalRequired}
          hint={
            generalRequired
              ? 'Describe what you need, including sizes, quantities and standards.'
              : 'Add anything that helps us quote accurately.'
          }
          error={e('generalDescription')}
        >
          <textarea
            id="field-generalDescription"
            rows={4}
            aria-invalid={!!e('generalDescription') || undefined}
            aria-describedby={describedBy(
              'field-generalDescription',
              true,
              e('generalDescription'),
            )}
            className={`${inputClass} mt-1`}
            {...register('generalDescription')}
          />
        </Field>
        <Field
          id="field-neededBy"
          label="Needed by"
          hint="Format: YYYY-MM-DD"
          error={e('neededBy')}
        >
          <input
            id="field-neededBy"
            type="date"
            min={minDate || undefined}
            autoComplete="off"
            aria-invalid={!!e('neededBy') || undefined}
            aria-describedby={describedBy('field-neededBy', true, e('neededBy'))}
            className={`${inputClass} mt-1 max-w-xs`}
            {...register('neededBy')}
          />
        </Field>
        <Field
          id="field-solicitationNumber"
          label="Solicitation or contract number"
          error={e('solicitationNumber')}
        >
          <input
            id="field-solicitationNumber"
            autoComplete="off"
            className={`${inputClass} mt-1`}
            {...register('solicitationNumber')}
          />
        </Field>
        <Field
          id="field-deliveryDetails"
          label="Delivery location and details"
          hint="Address, dock or building, delivery windows."
          error={e('deliveryDetails')}
        >
          <textarea
            id="field-deliveryDetails"
            rows={3}
            aria-describedby="field-deliveryDetails-hint"
            className={`${inputClass} mt-1`}
            {...register('deliveryDetails')}
          />
        </Field>
        <Field
          id="field-specialInstructions"
          label="Special instructions"
          error={e('specialInstructions')}
        >
          <textarea
            id="field-specialInstructions"
            rows={3}
            className={`${inputClass} mt-1`}
            {...register('specialInstructions')}
          />
        </Field>
      </fieldset>

      <section aria-labelledby="attachments-heading">
        <h2 id="attachments-heading" className="text-2xl font-bold">
          Attachments
        </h2>
        <p className="mt-1 text-sm text-muted" id="attachments-hint">
          Optional. Up to {limits.maxFiles} files, {limits.maxFileMb} MB each and{' '}
          {limits.maxTotalMb} MB in total. Allowed types:{' '}
          {Object.keys(ALLOWED_ATTACHMENTS)
            .filter((x) => x !== 'jpeg')
            .join(', ')}
          .
        </p>
        <label htmlFor="attachments-input" className="mt-3 block font-semibold">
          Choose files to attach
        </label>
        <input
          id="attachments-input"
          type="file"
          multiple
          accept={Object.keys(ALLOWED_ATTACHMENTS)
            .map((x) => `.${x}`)
            .join(',')}
          aria-describedby="attachments-hint"
          onChange={(ev) => onFilesChosen(ev.target.files)}
          className={`${inputClass} mt-1`}
        />
        <p role="status" aria-live="polite" className="mt-2 text-sm" data-testid="file-status">
          {fileMessage}
        </p>
        {files.length > 0 && (
          <ul className="mt-3 space-y-2" data-testid="file-list">
            {files.map((f) => (
              <li key={f.id} className="rounded-md border border-line p-3">
                <p className="font-semibold">
                  {f.name} <span className="font-normal text-muted">({formatBytes(f.size)})</span>
                </p>
                {f.status === 'uploading' && (
                  <p className="text-sm">
                    <label htmlFor={`prog-${f.id}`}>Uploading {f.name}: </label>
                    <progress
                      id={`prog-${f.id}`}
                      max={100}
                      value={f.progress}
                      className="align-middle"
                    />{' '}
                    {f.progress}%
                  </p>
                )}
                {f.status === 'done' && <p className="text-sm text-success">Uploaded</p>}
                {f.status === 'error' && (
                  <p className="text-sm font-semibold text-danger">{f.error}</p>
                )}
                <div className="mt-1 flex gap-3">
                  {f.status === 'error' && f.file && (
                    <button type="button" onClick={() => retry(f)} className={buttonClass('quiet')}>
                      Retry<span className="sr-only"> {f.name}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(f.id)}
                    className={buttonClass('quiet')}
                  >
                    Remove<span className="sr-only"> {f.name}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {e('attachments') && <p className="mt-2 font-semibold text-danger">{e('attachments')}</p>}
      </section>

      <section aria-labelledby="send-heading" className="space-y-5">
        <h2 id="send-heading" className="text-2xl font-bold">
          Send your request
        </h2>
        <p className="rounded-md bg-accent-bg p-3 text-sm">
          This is a request for a quotation, not an order. Do not include controlled unclassified,
          classified or patient information.
        </p>
        <div className="flex items-start gap-3">
          <input
            id="field-privacyAcknowledged"
            type="checkbox"
            className="mt-1 h-6 w-6"
            aria-invalid={!!e('privacyAcknowledged') || undefined}
            aria-describedby={
              e('privacyAcknowledged') ? 'field-privacyAcknowledged-error' : undefined
            }
            {...register('privacyAcknowledged')}
          />
          <div>
            <label htmlFor="field-privacyAcknowledged" className="font-semibold">
              I have read the{' '}
              <Link href="/privacy" target="_blank" rel="noopener">
                privacy policy (opens in a new tab)
              </Link>{' '}
              and agree that RC Quartermaster may use these details to respond to my request.{' '}
              <span className="font-normal text-muted">(required)</span>
            </label>
            {e('privacyAcknowledged') && (
              <p id="field-privacyAcknowledged-error" className="mt-1 font-semibold text-danger">
                <span className="sr-only">Error: </span>
                {e('privacyAcknowledged')}
              </p>
            )}
          </div>
        </div>

        {/* Honeypot: hidden from people and assistive technology, bots tend to fill it in. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-10000px',
            width: 1,
            height: 1,
            overflow: 'hidden',
          }}
        >
          <label htmlFor="field-website">Leave this field empty</label>
          <input id="field-website" tabIndex={-1} autoComplete="off" {...register('website')} />
        </div>

        <div id="turnstile-box" tabIndex={-1}>
          <p className="font-semibold">Verification</p>
          <div ref={widgetRef} data-testid="turnstile" />
          {e('turnstileToken') && (
            <p className="mt-1 font-semibold text-danger">
              <span className="sr-only">Error: </span>
              {e('turnstileToken')}
            </p>
          )}
          {turnstileFailed && (
            <p className="mt-2 text-danger" role="alert">
              The verification check could not load. Please reload the page, or contact us
              {contact.phone ? ` on ${contact.phone}` : ''}
              {contact.email ? ` or ${contact.email}` : ''}.
            </p>
          )}
        </div>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={renderTurnstile}
          onError={() => setTurnstileFailed(true)}
        />

        <div>
          <button
            type="submit"
            disabled={submitting || uploading}
            className={buttonClass('primary')}
            onClick={() => clearErrors('root')}
          >
            {submitting
              ? 'Sending…'
              : uploading
                ? 'Waiting for uploads…'
                : 'Submit request for quote'}
          </button>
          <p role="status" aria-live="polite" className="mt-2 text-sm">
            {submitting ? 'Sending your request. Please wait.' : ''}
          </p>
        </div>
      </section>
    </form>
  )
}
