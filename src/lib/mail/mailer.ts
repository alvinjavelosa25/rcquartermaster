import type { Payload } from 'payload'

export interface MailMessage {
  to: string[]
  subject: string
  html: string
  text: string
  replyTo?: string
}

/** Transactional email. Production implementation uses Resend through Payload's email adapter. */
export interface Mailer {
  send(message: MailMessage): Promise<void>
}

export class PayloadMailer implements Mailer {
  constructor(private readonly payload: Payload) {}

  async send(message: MailMessage): Promise<void> {
    await this.payload.sendEmail({
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    })
  }
}
