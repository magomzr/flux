import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FlagsService } from '../../../src/modules/flags/services/flags.service';
import { AuditService } from '../../../src/modules/audit/services/audit.service';
import { FLAG_CHANGED_EVENT } from '../../../src/modules/delivery/delivery.types';

const ctx = { userId: 'user-1', tenantId: 'tenant-1', ip: '127.0.0.1' };

const mockFlag = {
  id: 'flag-1',
  projectId: 'project-1',
  key: 'new_checkout',
  name: 'New Checkout',
  description: null,
  type: 'boolean',
  createdAt: new Date(),
  updatedAt: new Date(),
  flagValues: [],
};

const mockFlagValue = {
  id: 'fv-1',
  flagId: 'flag-1',
  environmentId: 'env-1',
  enabled: false,
  value: null,
  rolloutPct: 100,
  updatedAt: new Date(),
  publishedAt: null,
  publishedBy: null,
};

const mockDb = {
  query: {
    flags: { findFirst: jest.fn(), findMany: jest.fn() },
    flagValues: { findFirst: jest.fn() },
    environments: { findMany: jest.fn() },
  },
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockEvents = { emit: jest.fn() };

describe('FlagsService', () => {
  let service: FlagsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FlagsService,
        { provide: 'DB', useValue: mockDb },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();

    service = module.get(FlagsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates flag and generates flag_values for each environment', async () => {
      mockDb.query.flags.findFirst.mockResolvedValue(null);
      mockDb.query.environments.findMany.mockResolvedValue([
        { id: 'env-1' },
        { id: 'env-2' },
        { id: 'env-3' },
      ]);

      const returningMock = jest.fn().mockResolvedValue([mockFlag]);
      const flagValuesMock = jest.fn().mockResolvedValue([]);
      mockDb.insert
        .mockReturnValueOnce({
          values: jest.fn().mockReturnValue({ returning: returningMock }),
        })
        .mockReturnValueOnce({ values: flagValuesMock });

      const result = await service.create(
        'project-1',
        {
          key: 'new_checkout',
          name: 'New Checkout',
          type: 'boolean',
        },
        ctx,
      );

      expect(result.key).toBe('new_checkout');
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      expect(flagValuesMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ environmentId: 'env-1' }),
          expect.objectContaining({ environmentId: 'env-2' }),
          expect.objectContaining({ environmentId: 'env-3' }),
        ]),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'flag.created' }),
      );
    });

    it('creates flag without flag_values when project has no environments', async () => {
      mockDb.query.flags.findFirst.mockResolvedValue(null);
      mockDb.query.environments.findMany.mockResolvedValue([]);

      const returningMock = jest.fn().mockResolvedValue([mockFlag]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: returningMock }),
      });

      await service.create(
        'project-1',
        { key: 'new_checkout', name: 'New Checkout' },
        ctx,
      );

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when key already exists in project', async () => {
      mockDb.query.flags.findFirst.mockResolvedValue(mockFlag);

      await expect(
        service.create(
          'project-1',
          { key: 'new_checkout', name: 'New Checkout' },
          ctx,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('defaults type to boolean when not specified', async () => {
      mockDb.query.flags.findFirst.mockResolvedValue(null);
      mockDb.query.environments.findMany.mockResolvedValue([]);

      const returningMock = jest
        .fn()
        .mockResolvedValue([{ ...mockFlag, type: 'boolean' }]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: returningMock }),
      });

      const result = await service.create(
        'project-1',
        { key: 'my_flag', name: 'My Flag' },
        ctx,
      );
      expect(result.type).toBe('boolean');
    });
  });

  describe('findOne', () => {
    it('returns flag with flagValues', async () => {
      const flagWithValues = { ...mockFlag, flagValues: [mockFlagValue] };
      mockDb.query.flags.findFirst.mockResolvedValue(flagWithValues);

      const result = await service.findOne('flag-1');
      expect(result.flagValues).toHaveLength(1);
    });

    it('throws NotFoundException when flag does not exist', async () => {
      mockDb.query.flags.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateFlagValue', () => {
    it('updates flag value and emits FLAG_CHANGED_EVENT', async () => {
      mockDb.query.flagValues.findFirst.mockResolvedValue(mockFlagValue);

      const updatedFv = { ...mockFlagValue, enabled: true };
      const returningMock = jest.fn().mockResolvedValue([updatedFv]);
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ returning: returningMock }),
        }),
      });

      await service.updateFlagValue('flag-1', 'env-1', { enabled: true }, ctx);

      expect(mockEvents.emit).toHaveBeenCalledWith(
        FLAG_CHANGED_EVENT,
        expect.objectContaining({ environmentId: 'env-1' }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'flag_value.updated' }),
      );
    });

    it('throws NotFoundException when flag value does not exist', async () => {
      mockDb.query.flagValues.findFirst.mockResolvedValue(null);

      await expect(
        service.updateFlagValue('flag-1', 'env-1', { enabled: true }, ctx),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('publishFlagValue', () => {
    it('sets publishedAt and publishedBy, emits event, logs audit', async () => {
      mockDb.query.flagValues.findFirst.mockResolvedValue(mockFlagValue);

      const publishedFv = {
        ...mockFlagValue,
        publishedAt: new Date(),
        publishedBy: 'user-1',
      };
      const returningMock = jest.fn().mockResolvedValue([publishedFv]);
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ returning: returningMock }),
        }),
      });

      const result = await service.publishFlagValue('flag-1', 'env-1', ctx);

      expect(result.publishedAt).toBeDefined();
      expect(result.publishedBy).toBe('user-1');
      expect(mockEvents.emit).toHaveBeenCalledWith(
        FLAG_CHANGED_EVENT,
        expect.objectContaining({ environmentId: 'env-1' }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'flag_value.published' }),
      );
    });
  });

  describe('removePermanently', () => {
    it('deletes flag and logs audit', async () => {
      mockDb.query.flags.findFirst.mockResolvedValue(mockFlag);
      const whereMock = jest.fn().mockResolvedValue([]);
      mockDb.delete.mockReturnValue({ where: whereMock });

      await service.removePermanently('flag-1', ctx);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'flag.deleted' }),
      );
    });
  });
});
