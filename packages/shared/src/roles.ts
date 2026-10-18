export const TEAM_ROLES = ['owner', 'admin', 'member'] as const

export type TeamRole = (typeof TEAM_ROLES)[number]

export function isTeamRole(value: unknown): value is TeamRole {
  return typeof value === 'string' && (TEAM_ROLES as readonly string[]).includes(value)
}
