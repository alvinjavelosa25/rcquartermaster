import type { PrivateStorage } from '@/lib/storage/types'
import { getEnv } from '@/env'

export type ScanStatus = 'clean' | 'infected' | 'error' | 'skipped'

export interface ScanResult {
  status: ScanStatus
  detail?: string
}

/**
 * Virus-scan hook. Implement this interface for the chosen provider (ClamAV service, Cloudmersive, ...)
 * and register it in `getScanner`. The pipeline only depends on this contract.
 */
export interface AttachmentScanner {
  scan(input: { key: string; storage: PrivateStorage; originalName: string }): Promise<ScanResult>
}

/** Default: no scanning. Attachments are marked `skipped`; see ALLOW_UNSCANNED_DOWNLOADS. */
export class NoopScanner implements AttachmentScanner {
  async scan(): Promise<ScanResult> {
    return { status: 'skipped', detail: 'No scanner configured' }
  }
}

export function getScanner(): AttachmentScanner {
  switch (getEnv().SCANNER_PROVIDER) {
    case 'none':
    default:
      return new NoopScanner()
  }
}

/** Policy: may staff download an attachment with this scan status? */
export function canDownload(status: string, allowUnscanned: boolean): boolean {
  return status === 'clean' || (status === 'skipped' && allowUnscanned)
}
