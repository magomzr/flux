import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProjectsService } from '../../../src/modules/projects/services/projects.service';
import { AuditService } from '../../../src/modules/audit/services/audit.service';

const ctx = { userId: 'user-1', tenantId: 'tenant-1', ip: '127.0.0.1' };

const mockProject = {
  id: 'project-1',
  tenantId: 'tenant-1',
  name: 'App Móvil',
  slug: 'app-movil',
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDb = {
  query: { projects: { findFirst: jest.fn(), findMany: jest.fn() } },
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: 'DB', useValue: mockDb },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(ProjectsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates project and logs audit', async () => {
      mockDb.query.projects.findFirst.mockResolvedValue(null);
      const returningMock = jest.fn().mockResolvedValue([mockProject]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: returningMock }),
      });

      const result = await service.create(
        { tenantId: 'tenant-1', name: 'App Móvil', slug: 'app-movil' },
        ctx,
      );

      expect(result.slug).toBe('app-movil');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'project.created' }),
      );
    });

    it('throws ConflictException when slug is taken in tenant', async () => {
      mockDb.query.projects.findFirst.mockResolvedValue(mockProject);

      await expect(
        service.create(
          { tenantId: 'tenant-1', name: 'Dup', slug: 'app-movil' },
          ctx,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('returns project when found', async () => {
      mockDb.query.projects.findFirst.mockResolvedValue(mockProject);
      const result = await service.findOne('project-1');
      expect(result.id).toBe('project-1');
    });

    it('throws NotFoundException when not found', async () => {
      mockDb.query.projects.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false and logs audit', async () => {
      mockDb.query.projects.findFirst.mockResolvedValue(mockProject);
      const deactivated = { ...mockProject, isActive: false };
      const returningMock = jest.fn().mockResolvedValue([deactivated]);
      mockDb.update.mockReturnValue({
        set: jest
          .fn()
          .mockReturnValue({
            where: jest.fn().mockReturnValue({ returning: returningMock }),
          }),
      });

      const result = await service.deactivate('project-1', ctx);

      expect(result.isActive).toBe(false);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'project.deactivated' }),
      );
    });
  });

  describe('removePermanently', () => {
    it('deletes project and logs audit', async () => {
      mockDb.query.projects.findFirst.mockResolvedValue(mockProject);
      mockDb.delete.mockReturnValue({ where: jest.fn().mockResolvedValue([]) });

      await service.removePermanently('project-1', ctx);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'project.deleted' }),
      );
    });
  });
});
