import { Component, inject, signal, input, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { DatePipe } from "@angular/common";
import { EnvironmentsService } from "../../core/api/environments.service";
import type { Environment } from "../../core/models/api.models";

const PRESET_COLORS = [
  { label: "Production", color: "#ef4444" },
  { label: "Staging", color: "#f59e0b" },
  { label: "Dev", color: "#22c55e" },
  { label: "Indigo", color: "#6366f1" },
  { label: "Cyan", color: "#06b6d4" },
];

@Component({
  selector: "app-environment-list",
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: "environment-list.html",
})
export class EnvironmentList implements OnInit {
  readonly projectId = input.required<string>();

  private readonly environmentsService = inject(EnvironmentsService);
  private readonly fb = inject(FormBuilder);

  readonly environments = signal<Environment[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingEnv = signal<Environment | null>(null);

  readonly presetColors = PRESET_COLORS;

  readonly form = this.fb.nonNullable.group({
    name: ["", Validators.required],
    slug: ["", [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    color: ["#6366f1"],
  });

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.environmentsService.findAll(this.projectId()).subscribe({
      next: (data) => {
        this.environments.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  create() {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.formError.set(null);

    const { name, slug, color } = this.form.getRawValue();

    this.environmentsService.create(this.projectId(), { name, slug, color }).subscribe({
      next: (env) => {
        this.environments.update((list) => [...list, env]);
        this.cancelForm();
        this.saving.set(false);
      },
      error: (err) => {
        this.formError.set(err.status === 409 ? "Slug already taken." : "Something went wrong.");
        this.saving.set(false);
      },
    });
  }

  confirmDelete(env: Environment) {
    this.deletingEnv.set(env);
  }

  deleteEnv() {
    const env = this.deletingEnv();
    if (!env) return;

    this.environmentsService.remove(this.projectId(), env.id).subscribe({
      next: () => {
        this.environments.update((list) => list.filter((e) => e.id !== env.id));
        this.deletingEnv.set(null);
      },
    });
  }

  cancelForm() {
    this.showForm.set(false);
    this.form.reset({ color: "#6366f1" });
    this.formError.set(null);
  }
}
