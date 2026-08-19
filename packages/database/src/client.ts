import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.js';

export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('DATABASE_URL is required.');
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}
