import { Component, inject, signal, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ProjectsService } from "../../core/api/projects.service";
import { AuthService } from "../../core/auth/auth.service";
import type { Project } from "../../core/models/api.models";

@Component({
  selector: "app-project-list",
  imports: [ReactiveFormsModule],
  templateUrl: "project-list.html",
})
export class ProjectList implements OnInit {
  private readonly projectsService = inject(ProjectsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly projects = signal<Project[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingProject = signal<Project | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ["", Validators.required],
    slug: ["", [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    description: [""],
  });

  ngOnInit() {
    this.load();
  }

  openProject(project: Project) {
    this.router.navigate(["/projects", project.id]);
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

    this.projectsService
      .create(tenantId, {
        name,
        slug,
        description: description || undefined,
      })
      .subscribe({
        next: (project) => {
          this.projects.update((list) => [project, ...list]);
          this.cancelForm();
          this.saving.set(false);
        },
        error: (err) => {
          this.formError.set(err.status === 409 ? "Este slug ya está en uso." : "Algo salió mal.");
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
