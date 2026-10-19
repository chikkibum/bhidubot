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
  <body style="margin:0;padding:24px;background:#f7f8f8;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1d1f;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e6e6e6;border-radius:8px;">
      <tr>
        <td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;">You're invited to ${team}</h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#62666d;">${inviter} invited you to join <strong style="color:#1c1d1f;">${team}</strong> on bhidubot.</p>
          <a href="${url}" style="display:inline-block;padding:10px 16px;background:#5e6ad2;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">Accept invitation</a>
          <p style="margin:24px 0 0;font-size:12px;color:#62666d;">Or open this link: ${url}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`
  const text = `${p.inviterName} invited you to join ${p.teamName} on bhidubot.\n\nAccept the invitation: ${p.acceptUrl}\n`
  return { subject, html, text }
}
