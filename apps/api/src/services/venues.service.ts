import type { AuthenticatedUser } from '@league/auth';
import {
  createFieldSchema,
  createVenueSchema,
  fieldAdminSchema,
  updateFieldSchema,
  updateVenueSchema,
  venueAdminListSchema,
  venueAdminSchema,
  type CreateFieldInput,
  type CreateVenueInput,
  type FieldAdminDto,
  type UpdateFieldInput,
  type UpdateVenueInput,
  type VenueAdminDto,
  type VenueAdminListDto,
} from '@league/contracts';
import type { Prisma, TenantDatabase, TenantTransaction } from '@league/database';
import { VersionConflictError, assertExpectedVersion, permissions } from '@league/domain';
import { Inject, Injectable } from '@nestjs/common';

import { DuplicateFacilityNameError, ResourceNotFoundError } from '../common/errors.js';
import type { RequestMetadata } from '../common/request.js';
import { TENANT_DATABASE } from '../common/tokens.js';
import { AccessService } from './access.service.js';
import { MutationService, type MutationContext } from './mutation.service.js';

const FACILITY_LIST_LIMIT = 200;

interface FieldRow {
  readonly organizationId: string;
  readonly venueId: string;
  readonly id: string;
  readonly name: string;
  readonly publicDirections: string | null;
  readonly hasLights: boolean;
  readonly fenceDistanceFeet: number | null;
  readonly active: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface VenueRow {
  readonly organizationId: string;
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly fields: readonly FieldRow[];
}

function toFieldDto(field: FieldRow): FieldAdminDto {
  return fieldAdminSchema.parse({
    organizationId: field.organizationId,
    venueId: field.venueId,
    fieldId: field.id,
    name: field.name,
    publicDirections: field.publicDirections,
    hasLights: field.hasLights,
    fenceDistanceFeet: field.fenceDistanceFeet,
    active: field.active,
    version: field.version,
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt.toISOString(),
  });
}

function toVenueDto(venue: VenueRow): VenueAdminDto {
  return venueAdminSchema.parse({
    organizationId: venue.organizationId,
    venueId: venue.id,
    name: venue.name,
    active: venue.active,
    version: venue.version,
    createdAt: venue.createdAt.toISOString(),
    updatedAt: venue.updatedAt.toISOString(),
    fields: venue.fields.map(toFieldDto),
  });
}

function venueAuditReference(venue: VenueAdminDto): Prisma.InputJsonValue {
  return {
    organizationId: venue.organizationId,
    venueId: venue.venueId,
    name: venue.name,
    active: venue.active,
    version: venue.version,
    createdAt: venue.createdAt,
    updatedAt: venue.updatedAt,
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return structuredClone(value) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class VenuesService {
  constructor(
    @Inject(TENANT_DATABASE) private readonly database: TenantDatabase,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(MutationService) private readonly mutations: MutationService,
  ) {}

  async list(
    organizationId: string,
    user: AuthenticatedUser,
    metadata: RequestMetadata,
  ): Promise<VenueAdminListDto> {
    return this.database.withTenant(
      { organizationId, userId: user.id, requestId: metadata.requestId, source: metadata.source },
      async (transaction) => {
        await this.access.assertPermission(
          transaction,
          organizationId,
          user.id,
          permissions.venueRead,
        );
        const venues = await transaction.venue.findMany({
          include: {
            fields: {
              where: { organizationId },
              orderBy: [{ name: 'asc' }, { id: 'asc' }],
              take: FACILITY_LIST_LIMIT,
            },
          },
          where: { organizationId },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: FACILITY_LIST_LIMIT,
        });
        return venueAdminListSchema.parse({ items: venues.map(toVenueDto) });
      },
    );
  }

  async createVenue(context: MutationContext, rawInput: CreateVenueInput): Promise<VenueAdminDto> {
    const input = createVenueSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.venueCreate,
      fingerprintPayload: { operation: 'venue.create', input },
      responseSchema: venueAdminSchema,
      responseStatus: 201,
      operation: async (transaction) => {
        let venue: VenueRow;
        try {
          venue = await transaction.venue.create({
            data: {
              organizationId: context.organizationId,
              name: input.name,
              active: input.active ?? true,
            },
            include: { fields: true },
          });
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw new DuplicateFacilityNameError('venue');
          }
          throw error;
        }
        const result = toVenueDto(venue);
        await this.mutations.record(transaction, context, {
          action: 'venue.created',
          targetType: 'Venue',
          targetId: venue.id,
          after: venueAuditReference(result),
        });
        return result;
      },
    });
  }

  async updateVenue(
    context: MutationContext,
    venueId: string,
    rawInput: UpdateVenueInput,
  ): Promise<VenueAdminDto> {
    const input = updateVenueSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.venueUpdate,
      fingerprintPayload: { operation: 'venue.update', venueId, input },
      responseSchema: venueAdminSchema,
      operation: async (transaction) => {
        const current = await this.findVenue(transaction, context.organizationId, venueId);
        assertExpectedVersion(input.expectedVersion, current.version);
        let count: number;
        try {
          ({ count } = await transaction.venue.updateMany({
            where: {
              organizationId: context.organizationId,
              id: venueId,
              version: input.expectedVersion,
            },
            data: {
              ...(input.name === undefined ? {} : { name: input.name }),
              ...(input.active === undefined ? {} : { active: input.active }),
              version: { increment: 1 },
            },
          }));
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw new DuplicateFacilityNameError('venue');
          }
          throw error;
        }
        if (count !== 1) {
          await this.throwVenueVersionConflict(
            transaction,
            context.organizationId,
            venueId,
            input.expectedVersion,
          );
        }
        const updated = await this.findVenue(transaction, context.organizationId, venueId);
        const before = toVenueDto(current);
        const result = toVenueDto(updated);
        await this.mutations.record(transaction, context, {
          action: 'venue.updated',
          targetType: 'Venue',
          targetId: venueId,
          before: venueAuditReference(before),
          after: venueAuditReference(result),
        });
        return result;
      },
    });
  }

  async createField(
    context: MutationContext,
    venueId: string,
    rawInput: CreateFieldInput,
  ): Promise<FieldAdminDto> {
    const input = createFieldSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.fieldCreate,
      fingerprintPayload: { operation: 'field.create', venueId, input },
      responseSchema: fieldAdminSchema,
      responseStatus: 201,
      operation: async (transaction) => {
        await this.findVenue(transaction, context.organizationId, venueId);
        let field: FieldRow;
        try {
          field = await transaction.field.create({
            data: {
              organizationId: context.organizationId,
              venueId,
              name: input.name,
              publicDirections: input.publicDirections ?? null,
              hasLights: input.hasLights ?? false,
              fenceDistanceFeet: input.fenceDistanceFeet ?? null,
              active: input.active ?? true,
            },
          });
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw new DuplicateFacilityNameError('field');
          }
          throw error;
        }
        const result = toFieldDto(field);
        await this.mutations.record(transaction, context, {
          action: 'field.created',
          targetType: 'Field',
          targetId: field.id,
          after: json(result),
        });
        return result;
      },
    });
  }

  async updateField(
    context: MutationContext,
    venueId: string,
    fieldId: string,
    rawInput: UpdateFieldInput,
  ): Promise<FieldAdminDto> {
    const input = updateFieldSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.fieldUpdate,
      fingerprintPayload: { operation: 'field.update', venueId, fieldId, input },
      responseSchema: fieldAdminSchema,
      operation: async (transaction) => {
        const current = await this.findField(transaction, context.organizationId, venueId, fieldId);
        assertExpectedVersion(input.expectedVersion, current.version);
        let count: number;
        try {
          ({ count } = await transaction.field.updateMany({
            where: {
              organizationId: context.organizationId,
              id: fieldId,
              venueId,
              version: input.expectedVersion,
            },
            data: {
              ...(input.name === undefined ? {} : { name: input.name }),
              ...(input.publicDirections === undefined
                ? {}
                : { publicDirections: input.publicDirections }),
              ...(input.hasLights === undefined ? {} : { hasLights: input.hasLights }),
              ...(input.fenceDistanceFeet === undefined
                ? {}
                : { fenceDistanceFeet: input.fenceDistanceFeet }),
              ...(input.active === undefined ? {} : { active: input.active }),
              version: { increment: 1 },
            },
          }));
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw new DuplicateFacilityNameError('field');
          }
          throw error;
        }
        if (count !== 1) {
          await this.throwFieldVersionConflict(
            transaction,
            context.organizationId,
            venueId,
            fieldId,
            input.expectedVersion,
          );
        }
        const updated = await this.findField(transaction, context.organizationId, venueId, fieldId);
        const before = toFieldDto(current);
        const result = toFieldDto(updated);
        await this.mutations.record(transaction, context, {
          action: 'field.updated',
          targetType: 'Field',
          targetId: fieldId,
          before: json(before),
          after: json(result),
        });
        return result;
      },
    });
  }

  private async findVenue(
    transaction: TenantTransaction,
    organizationId: string,
    venueId: string,
  ): Promise<VenueRow> {
    const venue = await transaction.venue.findUnique({
      where: { organizationId_id: { organizationId, id: venueId } },
      include: {
        fields: {
          where: { organizationId },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: FACILITY_LIST_LIMIT,
        },
      },
    });
    if (venue === null) {
      throw new ResourceNotFoundError();
    }
    return venue;
  }

  private async findField(
    transaction: TenantTransaction,
    organizationId: string,
    venueId: string,
    fieldId: string,
  ): Promise<FieldRow> {
    const field = await transaction.field.findFirst({
      where: { organizationId, id: fieldId, venueId },
    });
    if (field === null || field.organizationId !== organizationId) {
      throw new ResourceNotFoundError();
    }
    return field;
  }

  private async throwVenueVersionConflict(
    transaction: TenantTransaction,
    organizationId: string,
    venueId: string,
    expectedVersion: number,
  ): Promise<never> {
    const latest = await transaction.venue.findUnique({
      where: { organizationId_id: { organizationId, id: venueId } },
      select: { version: true },
    });
    if (latest === null) {
      throw new ResourceNotFoundError();
    }
    throw new VersionConflictError(expectedVersion, latest.version);
  }

  private async throwFieldVersionConflict(
    transaction: TenantTransaction,
    organizationId: string,
    venueId: string,
    fieldId: string,
    expectedVersion: number,
  ): Promise<never> {
    const latest = await transaction.field.findFirst({
      where: { organizationId, id: fieldId, venueId },
      select: { organizationId: true, version: true },
    });
    if (latest === null || latest.organizationId !== organizationId) {
      throw new ResourceNotFoundError();
    }
    throw new VersionConflictError(expectedVersion, latest.version);
  }
}
