import type { EmailMessage } from '../mailer'
import { escapeHtml } from './escape'

export interface InvitationParams {
  inviterName: string
  teamName: string
  acceptUrl: string
}

export function renderInvitationEmail(p: InvitationParams): Omit<EmailMessage, 'to'> {
  const inviter = escapeHtml(p.inviterName)
  const team = escapeHtml(p.teamName)
  const url = escapeHtml(p.acceptUrl)
  const subject = `${p.inviterName} invited you to ${p.teamName} on bhidubot`
  const html = `<!doctype html>
<html>
  <body bgcolor="#010102" style="margin:0;padding:24px;background:#010102;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#d0d6e0;">
    <table role="presentation" width="100%" bgcolor="#0f1011" style="max-width:480px;margin:0 auto;background:#0f1011;border:1px solid #23252a;border-radius:8px;">
      <tr>
        <td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#f7f8f8;">You're invited to ${team}</h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#d0d6e0;">${inviter} invited you to join <strong style="color:#f7f8f8;">${team}</strong> on bhidubot.</p>
          <a href="${url}" style="display:inline-block;padding:10px 16px;background:#5e6ad2;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Accept invitation</a>
          <p style="margin:24px 0 0;font-size:12px;color:#d0d6e0;">Or open this link: ${url}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`
  const text = `${p.inviterName} invited you to join ${p.teamName} on bhidubot.\n\nAccept the invitation: ${p.acceptUrl}\n`
  return { subject, html, text }
}
