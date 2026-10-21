import { type Db, organization } from '@bhidubot/db'
import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import type { teamPlugin } from '../plugins/team'

/** `GET /api/me` (auth) and `GET /api/teams/current` (team). */
export function meRoutes(db: Db, team: ReturnType<typeof teamPlugin>) {
  return new Elysia()
    .use(team)
    .get(
      '/api/me',
      ({ user, session }) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        isInstanceAdmin: user.isInstanceAdmin === true,
        activeTeamId: session.activeOrganizationId ?? null,
      }),
      { auth: true },
    )
    .get(
      '/api/teams/current',
      async ({ team, status }) => {
        const [row] = await db
          .select({ name: organization.name })
          .from(organization)
          .where(eq(organization.id, team.id))
          .limit(1)
        if (!row) return status(404, { error: 'team_not_found' as const })
        return { id: team.id, name: row.name, role: team.role }
      },
      { team: true },
    )
}
