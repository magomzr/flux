import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── Tenants ────────────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  email: text('email').notNull(),
  logoUrl: text('logo_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id), // null = usuario interno
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    role: text('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at'),
  },
  (t) => [
    check(
      'users_role_check',
      sql`${t.role} IN (
    'super_admin','tenant_admin','developer','editor','viewer','ops'
  )`,
    ),
  ],
);

// ─── Refresh tokens ──────────────────────────────────────────────────────────

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  familyId: uuid('family_id').notNull(), // para revocación de familia
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Environments ────────────────────────────────────────────────────────────

export const environments = pgTable('environments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // production, staging, development
  slug: text('slug').notNull(),
  color: text('color'), // para identificarlo visualmente en el dashboard
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── SDK API Keys ─────────────────────────────────────────────────────────────

export const sdkApiKeys = pgTable('sdk_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id')
    .notNull()
    .references(() => environments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // label descriptivo: "Android prod key"
  keyHash: text('key_hash').notNull(), // nunca guardamos la key en texto plano
  keyPrefix: text('key_prefix').notNull(), // ej: "fflow_live_" para mostrar en UI
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'), // null = no expira
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Flags ───────────────────────────────────────────────────────────────────

export const flags = pgTable(
  'flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    key: text('key').notNull(), // identificador usado en el SDK: 'new_checkout_flow'
    name: text('name').notNull(), // nombre legible para el dashboard
    description: text('description'),
    type: text('type').notNull().default('boolean'), // boolean | string | number | json
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'flags_type_check',
      sql`${t.type} IN ('boolean','string','number','json')`,
    ),
  ],
);

// ─── Flag values (por ambiente) ───────────────────────────────────────────────

export const flagValues = pgTable('flag_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  flagId: uuid('flag_id')
    .notNull()
    .references(() => flags.id, { onDelete: 'cascade' }),
  environmentId: uuid('environment_id')
    .notNull()
    .references(() => environments.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),
  value: text('value'), // JSON serializado para cualquier tipo
  rolloutPct: integer('rollout_pct').notNull().default(100), // 0-100
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  publishedAt: timestamp('published_at'), // null = nunca publicado
  publishedBy: uuid('published_by').references(() => users.id),
});

// ─── Assets ───────────────────────────────────────────────────────────────────

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  storageKey: text('storage_key').notNull(), // clave en R2/S3
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  url: text('url').notNull(), // URL pública o firmada
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Billing plans ────────────────────────────────────────────────────────────

export const plans = pgTable('plans', {
  id: text('id').primaryKey(), // 'free','standard','pro'
  name: text('name').notNull(),
  maxFlags: integer('max_flags'), // null = ilimitado
  maxProjects: integer('max_projects'),
  maxEnvironments: integer('max_environments'),
  maxEvaluationsMonth: integer('max_evaluations_month'),
  maxAssetStorageMb: integer('max_asset_storage_mb'),
  hasSse: boolean('has_sse').notNull().default(false),
  pollIntervalSeconds: integer('poll_interval_seconds').notNull().default(60),
  priceUsd: integer('price_usd').notNull().default(0), // en centavos
});

// ─── Tenant subscriptions ─────────────────────────────────────────────────────

export const tenantSubscriptions = pgTable('tenant_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endsAt: timestamp('ends_at'), // null = activo indefinidamente
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Usage records ────────────────────────────────────────────────────────────

export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  evaluationsCount: integer('evaluations_count').notNull().default(0),
  sseConnectionsMax: integer('sse_connections_max').notNull().default(0),
  assetStorageMb: integer('asset_storage_mb').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Audit logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(), // 'flag.published', 'project.created', etc.
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  metadata: text('metadata'), // JSON con el diff o contexto
  ip: text('ip'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const flagsRelations = relations(flags, ({ many }) => ({
  flagValues: many(flagValues),
}));

export const flagValuesRelations = relations(flagValues, ({ one }) => ({
  flag: one(flags, { fields: [flagValues.flagId], references: [flags.id] }),
  environment: one(environments, {
    fields: [flagValues.environmentId],
    references: [environments.id],
  }),
}));
