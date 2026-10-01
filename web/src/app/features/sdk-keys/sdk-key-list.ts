import { Component, inject, signal, input, computed, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { DatePipe } from "@angular/common";
import { EnvironmentsService } from "../../core/api/environments.service";
import { SdkKeysService } from "../../core/api/sdk-keys.service";
import type { Environment, SdkKey } from "../../core/models/api.models";

interface EnvWithKeys {
  env: Environment;
  keys: SdkKey[];
  expanded: boolean;
}

@Component({
  selector: "app-sdk-key-list",
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: "sdk-key-list.html",
})
export class SdkKeyList implements OnInit {
  readonly projectId = input.required<string>();

  private readonly environmentsService = inject(EnvironmentsService);
  private readonly sdkKeysService = inject(SdkKeysService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly creatingForEnv = signal<Environment | null>(null);
  readonly newKeyValue = signal<string | null>(null);
  readonly deletingKey = signal<{ env: Environment; key: SdkKey } | null>(null);

  private readonly _envItems = signal<EnvWithKeys[]>([]);
  readonly envItems = computed(() => this._envItems());

  readonly form = this.fb.nonNullable.group({
    name: ["", Validators.required],
  });

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.environmentsService.findAll(this.projectId()).subscribe({
      next: (envs) => {
        const items: EnvWithKeys[] = envs.map((env) => ({
          env,
          keys: [],
          expanded: true,
        }));
        this._envItems.set(items);
        this.loadKeysForAll(envs.map((e) => e.id));
      },
      error: () => this.loading.set(false),
    });
  }

  private loadKeysForAll(envIds: string[]) {
    let pending = envIds.length;
    if (pending === 0) {
      this.loading.set(false);
      return;
    }

    for (const envId of envIds) {
      this.sdkKeysService.findAll(this.projectId(), envId).subscribe({
        next: (keys) => {
          this._envItems.update((items) =>
            items.map((item) => (item.env.id === envId ? { ...item, keys } : item)),
          );
          if (--pending === 0) this.loading.set(false);
        },
        error: () => {
          if (--pending === 0) this.loading.set(false);
        },
      });
    }
  }

  openCreateForm(env: Environment) {
    this.creatingForEnv.set(env);
    this.form.reset();
    this.formError.set(null);
  }

  cancelCreate() {
    this.creatingForEnv.set(null);
    this.formError.set(null);
  }

  createKey() {
    const env = this.creatingForEnv();
    if (!env || this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.formError.set(null);

    this.sdkKeysService.create(this.projectId(), env.id, this.form.getRawValue()).subscribe({
      next: (created) => {
        // Mostrar la key raw — solo esta vez
        this.newKeyValue.set(created.key ?? null);

        // Agregar a la lista sin el campo key
        const { key: _raw, ...safeKey } = created;
        this._envItems.update((items) =>
          items.map((item) =>
            item.env.id === env.id ? { ...item, keys: [...item.keys, safeKey] } : item,
          ),
        );

        this.cancelCreate();
        this.saving.set(false);
      },
      error: () => {
        this.formError.set("Algo salió mal.");
        this.saving.set(false);
      },
    });
  }

  revoke(env: Environment, key: SdkKey) {
    this.sdkKeysService.revoke(this.projectId(), env.id, key.id).subscribe({
      next: () => {
        this._envItems.update((items) =>
          items.map((item) =>
            item.env.id === env.id
              ? {
                  ...item,
                  keys: item.keys.map((k) => (k.id === key.id ? { ...k, isActive: false } : k)),
                }
              : item,
          ),
        );
      },
    });
  }

  confirmDelete(env: Environment, key: SdkKey) {
    this.deletingKey.set({ env, key });
  }

  deleteKey() {
    const item = this.deletingKey();
    if (!item) return;

    this.sdkKeysService.remove(this.projectId(), item.env.id, item.key.id).subscribe({
      next: () => {
        this._envItems.update((items) =>
          items.map((i) =>
            i.env.id === item.env.id
              ? { ...i, keys: i.keys.filter((k) => k.id !== item.key.id) }
              : i,
          ),
        );
        this.deletingKey.set(null);
      },
    });
  }
}
