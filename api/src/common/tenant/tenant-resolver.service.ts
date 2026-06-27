import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { environments, flags, projects } from '../../db/schema';
import type { Db } from '../../db';

export type TenantResolvable = 'project' | 'environment' | 'flag';

@Injectable()
export class TenantResolverService {
  constructor(@Inject('DB') private readonly db: Db) {}

  async resolveTenantId(
    entity: TenantResolvable,
    entityId: string,
  ): Promise<string> {
    switch (entity) {
      case 'project':
        return this.fromProject(entityId);
      case 'environment':
        return this.fromEnvironment(entityId);
      case 'flag':
        return this.fromFlag(entityId);
    }
  }

  private async fromProject(projectId: string): Promise<string> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { tenantId: true },
    });

    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    return project.tenantId;
  }

  private async fromEnvironment(environmentId: string): Promise<string> {
    const environment = await this.db.query.environments.findFirst({
      where: eq(environments.id, environmentId),
      columns: { projectId: true },
    });

    if (!environment) {
      throw new NotFoundException(`Environment ${environmentId} not found`);
    }

    return this.fromProject(environment.projectId);
  }

  private async fromFlag(flagId: string): Promise<string> {
    const flag = await this.db.query.flags.findFirst({
      where: eq(flags.id, flagId),
      columns: { projectId: true },
    });

    if (!flag) throw new NotFoundException(`Flag ${flagId} not found`);

    return this.fromProject(flag.projectId);
  }
}
