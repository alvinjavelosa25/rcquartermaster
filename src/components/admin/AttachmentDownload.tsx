'use client'

import { useDocumentInfo } from '@payloadcms/ui'

/** Download link for an RFQ attachment. The server enforces role and scan status. */
export function AttachmentDownload() {
  const { id } = useDocumentInfo()
  if (!id) return null
  return (
    <p>
      <a
        href={`/api/rfq-attachments/${id}/download`}
        className="btn btn--style-primary btn--size-small"
      >
        Download file
      </a>{' '}
      <small>Available only when the virus-scan check has passed.</small>
    </p>
  )
}
