import { createPrismaClient, TenantDatabase } from '@league/database';

export const testDatabaseUrl = process.env.HOST_TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
export const databaseTestsEnabled = testDatabaseUrl !== undefined && testDatabaseUrl.length > 0;

export function testDatabase() {
  if (testDatabaseUrl === undefined) {
    throw new Error('A test database URL is required.');
  }
  const prisma = createPrismaClient(testDatabaseUrl);
  return { prisma, database: new TenantDatabase(prisma) };
}

export const fixtureIds = {
  organizationA: '00000000-0000-4000-8000-000000000001',
  organizationB: '00000000-0000-4000-8000-000000000002',
  leagueA: '00000000-0000-4000-8000-000000000101',
  seasonA: '00000000-0000-4000-8000-000000000201',
  seasonB: '00000000-0000-4000-8000-000000000202',
  teamSeasonA: '00000000-0000-4000-8000-000000000401',
} as const;

export async function userIdByEmail(
  prisma: ReturnType<typeof createPrismaClient>,
  email: string,
): Promise<string> {
  return (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
}
