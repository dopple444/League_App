export const publicationResourceKinds = ['SEASON', 'TEAM_SEASON', 'SCHEDULE'] as const;
export type PublicationResourceKind = (typeof publicationResourceKinds)[number];

export interface PublicationSnapshot<TPayload> {
  readonly organizationId: string;
  readonly resourceKind: PublicationResourceKind;
  readonly resourceId: string;
  readonly revision: number;
  readonly payload: Readonly<TPayload>;
  readonly publishedAt: Date;
  readonly withdrawnAt: Date | null;
}

export function isPublic<TPayload>(snapshot: PublicationSnapshot<TPayload>): boolean {
  return snapshot.withdrawnAt === null;
}

export function nextPublicationRevision(
  previous: Pick<PublicationSnapshot<unknown>, 'revision'> | null,
): number {
  return previous === null ? 1 : previous.revision + 1;
}

export class VersionConflictError extends Error {
  readonly code = 'VERSION_CONFLICT';

  constructor(
    readonly expectedVersion: number,
    readonly actualVersion: number,
  ) {
    super('The resource changed since it was loaded.');
    this.name = 'VersionConflictError';
  }
}

export function assertExpectedVersion(expectedVersion: number, actualVersion: number): void {
  if (expectedVersion !== actualVersion) {
    throw new VersionConflictError(expectedVersion, actualVersion);
  }
}
