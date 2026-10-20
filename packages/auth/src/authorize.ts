import { type Db, member } from '@bhidubot/db'
import { isTeamRole, type TeamRole } from '@bhidubot/shared'
import { and, eq } from 'drizzle-orm'

/**
 * Resolves a user's role in a team (an organization-plugin organization) from the `member` table.
 * Returns null when the user is not a member, or holds a role this app does not recognise.
 */
export async function getMembership(
  db: Db,
  userId: string,
  teamId: string,
): Promise<{ role: TeamRole } | null> {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, teamId)))
    .limit(1)
  if (!row || !isTeamRole(row.role)) return null
  return { role: row.role }
}
