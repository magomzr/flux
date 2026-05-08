import { Component, inject, signal, OnInit, input, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { ProjectsService } from '../../core/api/projects.service';
import { AuthService } from '../../core/auth/auth.service';
import type { Project } from '../../core/models/api.models';

@Component({
  selector: 'app-project-detail',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="p-6 max-w-5xl mx-auto">

      <!-- Header del proyecto -->
      @if (project()) {
        <div class="mb-6">
          <div class="flex items-center gap-2 text-xs mb-2" style="color: var(--text-muted)">
            <a routerLink="/projects" class="hover:text-white transition-colors cursor-pointer" style="color: var(--text-muted)">Projects</a>
            <span>/</span>
            <span style="color: var(--text-primary)">{{ project()!.name }}</span>
          </div>
          <h1 class="text-lg font-semibold" style="color: var(--text-primary)">{{ project()!.name }}</h1>
          @if (project()!.description) {
            <p class="text-sm mt-0.5" style="color: var(--text-muted)">{{ project()!.description }}</p>
          }
        </div>
      }

      <!-- Tabs -->
      <nav class="flex gap-1 mb-6 border-b" style="border-color: var(--border)">
        <a [routerLink]="['flags']"
           routerLinkActive="border-b-2 border-indigo-500"
           class="text-sm px-3 pb-3 -mb-px transition-colors hover:text-zinc-200"
           style="color: var(--text-secondary)">
          Flags
        </a>
        <a [routerLink]="['environments']"
           routerLinkActive="border-b-2 border-indigo-500"
           class="text-sm px-3 pb-3 -mb-px transition-colors hover:text-zinc-200"
           style="color: var(--text-secondary)">
          Environments
        </a>
        <a [routerLink]="['sdk-keys']"
           routerLinkActive="border-b-2 border-indigo-500"
           class="text-sm px-3 pb-3 -mb-px transition-colors hover:text-zinc-200"
           style="color: var(--text-secondary)">
          SDK Keys
        </a>
      </nav>

      <router-outlet />
    </div>
  `,
})
export class ProjectDetail implements OnInit {
  readonly projectId = input.required<string>();

  private readonly projectsService = inject(ProjectsService);
  private readonly auth = inject(AuthService);

  readonly project = signal<Project | null>(null);

  ngOnInit() {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.projectsService.findOne(tenantId, this.projectId()).subscribe({
      next: (p) => this.project.set(p),
    });
  }
}
