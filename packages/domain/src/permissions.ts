export const permissions = {
  auditRead: 'audit:read',
  membershipRead: 'membership:read',
  roleAssign: 'role:assign',
  seasonCreate: 'season:create',
  seasonRead: 'season:read',
  seasonUpdate: 'season:update',
  seasonPublish: 'season:publish',
  teamCreate: 'team:create',
  teamRead: 'team:read',
  teamUpdate: 'team:update',
  teamPublish: 'team:publish',
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

export const authorityKinds = ['BOARD', 'OFFICER', 'OPERATIONS', 'AUDIT'] as const;
export type AuthorityKind = (typeof authorityKinds)[number];

export interface EffectiveRole {
  readonly roleId: string;
  readonly authorityKind: AuthorityKind;
  readonly permissions: readonly Permission[];
  readonly validFrom: Date;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
}

export interface AuthorizationContext {
  readonly organizationId: string;
  readonly userId: string;
  readonly roles: readonly EffectiveRole[];
  readonly evaluatedAt: Date;
}

export function isRoleEffective(role: EffectiveRole, at: Date): boolean {
  return (
    role.revokedAt === null &&
    role.validFrom.getTime() <= at.getTime() &&
    (role.expiresAt === null || role.expiresAt.getTime() > at.getTime())
  );
}

export function hasPermission(context: AuthorizationContext, permission: Permission): boolean {
  return context.roles.some(
    (role) => isRoleEffective(role, context.evaluatedAt) && role.permissions.includes(permission),
  );
}

export function requirePermission(context: AuthorizationContext, permission: Permission): void {
  if (!hasPermission(context, permission)) {
    throw new AuthorizationDeniedError(permission);
  }
}

export class AuthorizationDeniedError extends Error {
  readonly code = 'AUTHORIZATION_DENIED';

  constructor(readonly permission: Permission) {
    super('You do not have permission to perform this action.');
    this.name = 'AuthorizationDeniedError';
  }
}
