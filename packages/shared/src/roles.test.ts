import { describe, expect, test } from 'bun:test'
import { isTeamRole, TEAM_ROLES } from './roles'

describe('team roles', () => {
  test('lists roles in privilege order', () => {
    expect(TEAM_ROLES).toEqual(['owner', 'admin', 'member'])
  })
  test('narrows known roles and rejects unknown values', () => {
    expect(isTeamRole('admin')).toBe(true)
    expect(isTeamRole('superuser')).toBe(false)
    expect(isTeamRole(undefined)).toBe(false)
  })
})
