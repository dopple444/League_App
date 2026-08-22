import { permissions } from '@league/domain';
import { describe, expect, it } from 'vitest';

import { AccessService } from '../../src/services/access.service.js';
import {
  databaseTestsEnabled,
  fixtureIds,
  testDatabase,
  userIdByEmail,
} from '../helpers/database.js';

describe.skipIf(!databaseTestsEnabled)('authorization matrix', () => {
  it('keeps board, auditor, officer, and revoked authority distinct', async () => {
    const { prisma, database } = testDatabase();
    const access = new AccessService(database);
    try {
      const users = {
        admin: await userIdByEmail(prisma, 'admin@demo.invalid'),
        board: await userIdByEmail(prisma, 'board@demo.invalid'),
        auditor: await userIdByEmail(prisma, 'auditor@demo.invalid'),
        revoked: await userIdByEmail(prisma, 'revoked@demo.invalid'),
      };
      const check = (
        userId: string,
        permission: Parameters<AccessService['assertPermission']>[3],
      ) =>
        database.withTenant(
          {
            organizationId: fixtureIds.organizationA,
            userId,
            requestId: `authz-${userId}`,
            source: 'API',
          },
          async (transaction) =>
            access.assertPermission(transaction, fixtureIds.organizationA, userId, permission),
        );

      await expect(check(users.admin, permissions.seasonCreate)).resolves.toBeUndefined();
      await expect(check(users.admin, permissions.leagueRead)).resolves.toBeUndefined();
      await expect(check(users.admin, permissions.leagueCreate)).resolves.toBeUndefined();
      await expect(check(users.admin, permissions.leagueUpdate)).resolves.toBeUndefined();
      await expect(check(users.admin, permissions.venueRead)).resolves.toBeUndefined();
      await expect(check(users.admin, permissions.venueCreate)).resolves.toBeUndefined();
      await expect(check(users.admin, permissions.venueUpdate)).resolves.toBeUndefined();
      await expect(check(users.admin, permissions.fieldCreate)).resolves.toBeUndefined();
      await expect(check(users.admin, permissions.fieldUpdate)).resolves.toBeUndefined();
      await expect(check(users.board, permissions.auditRead)).resolves.toBeUndefined();
      await expect(check(users.board, permissions.seasonCreate)).rejects.toThrow();
      await expect(check(users.board, permissions.leagueRead)).rejects.toThrow();
      await expect(check(users.board, permissions.leagueUpdate)).rejects.toThrow();
      await expect(check(users.board, permissions.venueRead)).rejects.toThrow();
      await expect(check(users.board, permissions.fieldUpdate)).rejects.toThrow();
      await expect(check(users.auditor, permissions.auditRead)).resolves.toBeUndefined();
      await expect(check(users.auditor, permissions.roleAssign)).rejects.toThrow();
      await expect(check(users.revoked, permissions.seasonCreate)).rejects.toThrow();
      await expect(check(users.revoked, permissions.leagueCreate)).rejects.toThrow();
    } finally {
      await prisma.$disconnect();
    }
  });
});
