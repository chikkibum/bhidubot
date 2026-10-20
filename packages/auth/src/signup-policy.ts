import { type Db, invitation, user } from '@bhidubot/db'
import { and, eq, gt, sql } from 'drizzle-orm'

export type SignupDecision = { allowed: true; isInstanceAdmin: boolean } | { allowed: false }

/**
 * Decides whether `email` may create an account. Rules, in order:
 * 1. no users yet → allowed, and the user becomes instance admin;
 * 2. the email's domain is in `allowedDomains` → allowed;
 * 3. a pending, unexpired invitation exists for the email (case-insensitive) → allowed;
 * 4. otherwise → not allowed.
 *
 * Rule 1 is race-prone on its own; the `one_instance_admin` partial unique index makes concurrent
 * first sign-ups safe (only one insert with `is_instance_admin = true` can commit).
 */
export async function evaluateSignup(
  db: Db,
  email: string,
  allowedDomains: string[],
): Promise<SignupDecision> {
  const normalised = email.trim().toLowerCase()

  const anyUser = await db.select({ id: user.id }).from(user).limit(1)
  if (anyUser.length === 0) return { allowed: true, isInstanceAdmin: true }

  const domain = normalised.slice(normalised.lastIndexOf('@') + 1)
  if (domain && allowedDomains.some((d) => d.trim().toLowerCase() === domain)) {
    return { allowed: true, isInstanceAdmin: false }
  }

  const invite = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        sql`lower(trim(${invitation.email})) = ${normalised}`,
        eq(invitation.status, 'pending'),
        // Better Auth stores UTC wall-clock in `timestamp` (no tz) columns; compare on the same basis.
        gt(invitation.expiresAt, sql`(now() at time zone 'utc')`),
      ),
    )
    .limit(1)
  if (invite.length > 0) return { allowed: true, isInstanceAdmin: false }

  return { allowed: false }
}
