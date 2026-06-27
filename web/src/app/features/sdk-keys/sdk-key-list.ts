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
  template: `
    <div>
      <div class="mb-6">
        <h2 class="text-base font-semibold" style="color: var(--text-primary)">SDK Keys</h2>
        <p class="text-sm mt-0.5" style="color: var(--text-muted)">
          One key per environment. Used to authenticate the SDK.
        </p>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="space-y-3">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="h-16 rounded-xl animate-pulse skeleton"></div>
          }
        </div>
      }

      <!-- Lista por ambiente -->
      @if (!loading()) {
        <div class="space-y-4">
          @for (item of envItems(); track item.env.id) {
            <div class="border rounded-xl overflow-hidden" style="border-color: var(--border)">
              <!-- Header del ambiente -->
              <div
                class="flex items-center gap-3 px-4 py-3"
                style="background-color: var(--bg-surface)"
              >
                <div
                  class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  [style.background-color]="item.env.color ?? '#52525b'"
                ></div>
                <span class="text-sm font-medium flex-1" style="color: var(--text-primary)">{{
                  item.env.name
                }}</span>
                <span class="text-xs" style="color: var(--text-muted)"
                  >{{ item.keys.length }} key{{ item.keys.length !== 1 ? "s" : "" }}</span
                >
                <button
                  (click)="openCreateForm(item.env)"
                  class="text-xs transition-colors cursor-pointer"
                  style="color: var(--accent-text)"
                >
                  + Generate key
                </button>
              </div>

              <!-- Keys del ambiente -->
              @if (item.keys.length > 0) {
                <div class="divide-y" style="border-color: var(--border-subtle)">
                  @for (key of item.keys; track key.id) {
                    <div
                      class="flex items-center gap-4 px-4 py-3"
                      style="border-color: var(--border-subtle)"
                    >
                      <div class="flex-1 min-w-0">
                        <p class="text-sm" style="color: var(--text-primary)">{{ key.name }}</p>
                        <p class="text-xs font-mono mt-0.5" style="color: var(--text-muted)">
                          {{ key.keyPrefix }}_••••••••
                        </p>
                      </div>

                      @if (key.lastUsedAt) {
                        <p class="text-xs" style="color: var(--text-muted)">
                          Last used {{ key.lastUsedAt | date: "MMM d" }}
                        </p>
                      }

                      @if (!key.isActive) {
                        <span
                          class="text-xs px-2 py-0.5 rounded"
                          style="color: var(--warning-fg); background-color: var(--warning-subtle)"
                          >Revoked</span
                        >
                      }

                      @if (key.isActive) {
                        <button
                          (click)="revoke(item.env, key)"
                          class="text-xs transition-colors cursor-pointer"
                          style="color: var(--danger-fg)"
                        >
                          Revoke
                        </button>
                      }
                      <button
                        (click)="confirmDelete(item.env, key)"
                        class="text-xs transition-colors cursor-pointer"
                        style="color: var(--danger-fg)"
                      >
                        Delete
                      </button>
                    </div>
                  }
                </div>
              } @else {
                <div class="px-4 py-4 text-xs" style="color: var(--text-muted)">
                  No keys yet for this environment.
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Create form modal -->
      @if (creatingForEnv()) {
        <div
          class="fixed inset-0 flex items-center justify-center z-50 px-4"
          style="background-color: var(--bg-overlay)"
        >
          <div
            class="border rounded-xl p-6 max-w-sm w-full"
            style="background-color: var(--bg-surface); border-color: var(--border)"
          >
            <h3 class="text-sm font-medium mb-4" style="color: var(--text-primary)">
              Generate key for
              <span style="color: var(--accent-text)">{{ creatingForEnv()!.name }}</span>
            </h3>

            <form [formGroup]="form" (ngSubmit)="createKey()" class="space-y-4">
              <div class="space-y-1">
                <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)"
                  >Label</label
                >
                <input
                  formControlName="name"
                  placeholder="Android prod key"
                  class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                  style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
                />
              </div>

              @if (formError()) {
                <p
                  class="text-xs rounded-lg px-3 py-2"
                  style="color: var(--danger-fg); background-color: var(--danger-subtle); border: 1px solid var(--danger-fg)"
                >
                  {{ formError() }}
                </p>
              }

              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  (click)="cancelCreate()"
                  class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  style="color: var(--text-secondary)"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="form.invalid || saving()"
                  class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style="background-color: var(--accent); color: var(--accent-fg)"
                >
                  {{ saving() ? "Generating..." : "Generate" }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Mostrar key generada — solo una vez -->
      @if (newKeyValue()) {
        <div
          class="fixed inset-0 flex items-center justify-center z-50 px-4"
          style="background-color: var(--bg-overlay)"
        >
          <div
            class="border rounded-xl p-6 max-w-md w-full"
            style="background-color: var(--bg-surface); border-color: var(--border)"
          >
            <h3 class="text-sm font-medium mb-1" style="color: var(--text-primary)">
              API key generated
            </h3>
            <p class="text-xs mb-4" style="color: var(--text-muted)">
              Copy this key now. You won't be able to see it again.
            </p>
            <div
              class="rounded-lg px-3 py-2.5 font-mono text-xs break-all mb-4"
              style="background-color: var(--mono-bg); color: var(--success-fg)"
            >
              {{ newKeyValue() }}
            </div>
            <div class="flex justify-end">
              <button
                (click)="newKeyValue.set(null)"
                class="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="background-color: var(--accent); color: var(--accent-fg)"
              >
                I've copied it
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Delete confirm -->
      @if (deletingKey()) {
        <div
          class="fixed inset-0 flex items-center justify-center z-50 px-4"
          style="background-color: var(--bg-overlay)"
        >
          <div
            class="border rounded-xl p-6 max-w-sm w-full"
            style="background-color: var(--bg-surface); border-color: var(--border)"
          >
            <h3 class="text-sm font-medium mb-2" style="color: var(--text-primary)">
              Delete SDK key
            </h3>
            <p class="text-sm mb-5" style="color: var(--text-secondary)">
              This will permanently delete
              <span class="font-medium" style="color: var(--text-primary)">{{
                deletingKey()!.key.name
              }}</span
              >. Any SDK using it will stop working immediately.
            </p>
            <div class="flex justify-end gap-2">
              <button
                (click)="deletingKey.set(null)"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)"
              >
                Cancel
              </button>
              <button
                (click)="deleteKey()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="background-color: var(--danger); color: #fff"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
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
        this.formError.set("Something went wrong.");
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
