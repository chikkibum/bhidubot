import nodemailer from 'nodemailer'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export interface Mailer {
  send(msg: EmailMessage): Promise<void>
}

export function createSmtpMailer(opts: { smtpUrl: string; from: string }): Mailer {
  const transport = nodemailer.createTransport(opts.smtpUrl)
  return {
    async send(msg) {
      await transport.sendMail({ from: opts.from, ...msg })
    },
  }
}

export function createMemoryMailer(): Mailer & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = []
  return {
    sent,
    async send(msg) {
      sent.push(msg)
    },
  }
}
