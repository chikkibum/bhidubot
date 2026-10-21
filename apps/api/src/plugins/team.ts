import { getMembership } from '@bhidubot/auth'
import type { Db } from '@bhidubot/db'
import type { TeamRole } from '@bhidubot/shared'
import { Elysia } from 'elysia'
import type { authPlugin } from './auth'

/**
 * Provides the `team: true` macro (implies `auth`). The team is always the session's active team
 * and membership is read from the database on every request — never from body, query or params.
 * - no active team → 409 `{ error: 'no_active_team' }`
 * - not a member (never was, or removed since) → 404 `{ error: 'team_not_found' }`; 404 rather than
 *   403 so the response never confirms that a team id exists.
 */
export function teamPlugin(db: Db, auth: ReturnType<typeof authPlugin>) {
  return new Elysia({ name: 'team' }).use(auth).macro('team', {
    auth: true,
    async resolve({ status, user, session }) {
      const teamId = session.activeOrganizationId
      if (!teamId) return status(409, { error: 'no_active_team' as const })
      const membership = await getMembership(db, user.id, teamId)
      if (!membership) return status(404, { error: 'team_not_found' as const })
      const team: { id: string; role: TeamRole } = { id: teamId, role: membership.role }
      return { team }
    },
  })
}
