# 0005. Email via SMTP, Mailpit locally

## Status

Accepted

## Context

The app sends team-invitation emails (and later others). Locally nothing may leave the developer's machine.

## Decision

`packages/email` exposes a small `Mailer` interface with an SMTP implementation (nodemailer, configured by an
SMTP URL) and an in-memory implementation for tests. Locally the SMTP URL points at Mailpit (SMTP 1025, UI 8025).

## Why

Provider-neutral; nothing is sent from a dev machine.

## Pros

- Any SMTP server, or Resend's SMTP endpoint, works in production unchanged.
- Tests can assert on delivery through Mailpit's API or the memory mailer.

## Cons

- No provider features (hosted templates, analytics).

## Alternatives considered

- The Resend SDK directly: vendor lock-in.
- Gmail SMTP: poor deliverability; it is what meeting-bot69 did.

## Consequences / follow-ups

- Templates are plain TS functions returning html and text, with all interpolated values HTML-escaped.
