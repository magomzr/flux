import { Component, inject, signal, OnInit, input } from "@angular/core";
import { RouterOutlet, RouterLink, RouterLinkActive } from "@angular/router";
import { ProjectsService } from "../../core/api/projects.service";
import { AuthService } from "../../core/auth/auth.service";
import type { Project } from "../../core/models/api.models";

@Component({
  selector: "app-project-detail",
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "project-detail.html",
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
