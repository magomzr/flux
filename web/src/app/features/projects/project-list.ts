import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectsService } from '../../core/api/projects.service';
import { AuthService } from '../../core/auth/auth.service';
import type { Project } from '../../core/models/api.models';

@Component({
  selector: 'app-project-list',
  imports: [ReactiveFormsModule],
  template: `
    <div class="p-6 max-w-5xl mx-auto">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color: var(--text-primary)">Projects</h1>
          <p class="text-sm mt-0.5" style="color: var(--text-muted)">{{ projects().length }} total</p>
        </div>
        <button
          (click)="showForm.set(true)"
          class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          style="background-color: var(--accent); color: var(--accent-fg)"
        >
          + New project
        </button>
      </div>

      <!-- Create form -->
      @if (showForm()) {
        <div class="border rounded-xl p-5 mb-6" style="background-color: var(--bg-surface); border-color: var(--border)">
          <h2 class="text-sm font-medium mb-4" style="color: var(--text-primary)">New project</h2>
          <form [formGroup]="form" (ngSubmit)="create()" class="grid grid-cols-2 gap-4">

            <div class="space-y-1">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Name</label>
              <input formControlName="name" placeholder="App Móvil"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
            </div>

            <div class="space-y-1">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Slug</label>
              <input formControlName="slug" placeholder="app-movil"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
            </div>

            <div class="space-y-1 col-span-2">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Description <span class="normal-case" style="color: var(--text-muted)">(optional)</span></label>
              <input formControlName="description" placeholder="What is this project about?"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
            </div>

            @if (formError()) {
              <p class="col-span-2 text-xs rounded-lg px-3 py-2" style="color: var(--danger-fg); background-color: var(--danger-subtle); border: 1px solid var(--danger-fg)">
                {{ formError() }}
              </p>
            }

            <div class="col-span-2 flex justify-end gap-2">
              <button type="button" (click)="cancelForm()"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)">
                Cancel
              </button>
              <button type="submit" [disabled]="form.invalid || saving()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style="background-color: var(--accent); color: var(--accent-fg)">
                {{ saving() ? 'Creating...' : 'Create project' }}
              </button>
            </div>

          </form>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (_ of [1,2,3]; track $index) {
            <div class="h-32 rounded-xl animate-pulse skeleton"></div>
          }
        </div>
      }

      <!-- Empty -->
      @if (!loading() && projects().length === 0) {
        <div class="text-center py-16">
          <p class="text-sm" style="color: var(--text-muted)">No projects yet. Create your first one.</p>
        </div>
      }

      <!-- Grid de proyectos -->
      @if (!loading() && projects().length > 0) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (project of projects(); track project.id) {
            <div
              (click)="openProject(project)"
              class="border rounded-xl p-4 cursor-pointer transition-all group"
              style="background-color: var(--bg-surface); border-color: var(--border)"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold"
                     style="background-color: var(--accent-subtle); color: var(--accent-text)">
                  {{ project.name.charAt(0).toUpperCase() }}
                </div>
                @if (!project.isActive) {
                  <span class="text-xs px-2 py-0.5 rounded-full" style="color: var(--text-muted); background-color: var(--bg-elevated)">Inactive</span>
                }
              </div>

              <h3 class="text-sm font-medium mb-1 transition-colors" style="color: var(--text-primary)">
                {{ project.name }}
              </h3>

              @if (project.description) {
                <p class="text-xs line-clamp-2" style="color: var(--text-muted)">{{ project.description }}</p>
              }

              <p class="text-xs mt-3 font-mono" style="color: var(--text-muted)">{{ project.slug }}</p>
            </div>
          }
        </div>
      }

      <!-- Delete confirm dialog -->
      @if (deletingProject()) {
        <div class="fixed inset-0 flex items-center justify-center z-50 px-4" style="background-color: var(--bg-overlay)">
          <div class="border rounded-xl p-6 max-w-sm w-full" style="background-color: var(--bg-surface); border-color: var(--border)">
            <h3 class="text-sm font-medium mb-2" style="color: var(--text-primary)">Delete project</h3>
            <p class="text-sm mb-5" style="color: var(--text-secondary)">
              This will permanently delete
              <span class="font-medium" style="color: var(--text-primary)">{{ deletingProject()!.name }}</span>
              and all its flags and environments. This cannot be undone.
            </p>
            <div class="flex justify-end gap-2">
              <button (click)="deletingProject.set(null)"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)">
                Cancel
              </button>
              <button (click)="deleteProject()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="background-color: var(--danger); color: #fff">
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
})
export class ProjectList implements OnInit {
  private readonly projectsService = inject(ProjectsService);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb     = inject(FormBuilder);

  readonly projects  = signal<Project[]>([]);
  readonly loading   = signal(true);
  readonly saving    = signal(false);
  readonly showForm  = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingProject = signal<Project | null>(null);

  readonly form = this.fb.nonNullable.group({
    name:        ['', Validators.required],
    slug:        ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    description: [''],
  });

  ngOnInit() {
    this.load();
  }

  openProject(project: Project) {
    this.router.navigate(['/projects', project.id]);
  }

  private load() {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.projectsService.findAll(tenantId).subscribe({
      next: (data) => {
        this.projects.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  create() {
    if (this.form.invalid || this.saving()) return;

    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.saving.set(true);
    this.formError.set(null);

    const { name, slug, description } = this.form.getRawValue();

    this.projectsService.create(tenantId, {
      name,
      slug,
      description: description || undefined,
    }).subscribe({
      next: (project) => {
        this.projects.update((list) => [project, ...list]);
        this.cancelForm();
        this.saving.set(false);
      },
      error: (err) => {
        this.formError.set(
          err.status === 409 ? 'Slug already taken in this tenant.' : 'Something went wrong.',
        );
        this.saving.set(false);
      },
    });
  }

  confirmDelete(project: Project) {
    this.deletingProject.set(project);
  }

  deleteProject() {
    const project = this.deletingProject();
    const tenantId = this.auth.tenantId();
    if (!project || !tenantId) return;

    this.projectsService.remove(tenantId, project.id).subscribe({
      next: () => {
        this.projects.update((list) => list.filter((p) => p.id !== project.id));
        this.deletingProject.set(null);
      },
    });
  }

  cancelForm() {
    this.showForm.set(false);
    this.form.reset();
    this.formError.set(null);
  }
}
