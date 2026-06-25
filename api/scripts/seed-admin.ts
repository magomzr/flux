/**
 * Seed script — creates the initial super_admin user.
 *
 * Run ONCE per new database. If a super_admin already exists, does nothing.
 *
 * Usage:
 *   ADMIN_EMAIL=mario@flux.com ADMIN_PASSWORD=your_password pnpm seed:admin
 *
 * Or with .env already configured:
 *   pnpm seed:admin
 *
 * Environment variables:
 *   DATABASE_URL   — PostgreSQL connection string (from .env or explicit)
 *   ADMIN_EMAIL    — email for the super_admin account
 *   ADMIN_PASSWORD — password (min 8 chars, never stored in code)
 *   ADMIN_NAME     — optional, defaults to "Super Admin"
 */

import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Super Admin';

  // ─── Validate ─────────────────────────────────────────────────────────────

  if (!databaseUrl) {
    console.error(
      '❌ DATABASE_URL is required. Set it in .env or pass explicitly.',
    );
    process.exit(1);
  }

  if (!email) {
    console.error('❌ ADMIN_EMAIL is required.');
    console.error(
      '   Usage: ADMIN_EMAIL=john.doe@flux.com ADMIN_PASSWORD=secret pnpm seed:admin',
    );
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error(
      '❌ ADMIN_PASSWORD is required and must be at least 8 characters.',
    );
    process.exit(1);
  }

  // ─── Connect ──────────────────────────────────────────────────────────────

  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  try {
    // ─── Check if super_admin already exists ──────────────────────────────────

    const existing = await db.query.users.findFirst({
      where: eq(schema.users.role, 'super_admin'),
    });

    if (existing) {
      console.log(
        `✅ Super admin already exists (${existing.email}). Nothing to do.`,
      );
      await client.end();
      process.exit(0);
    }

    // ─── Check email not taken ────────────────────────────────────────────────

    const emailTaken = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (emailTaken) {
      console.error(`❌ Email "${email}" is already in use by another user.`);
      await client.end();
      process.exit(1);
    }

    // ─── Create super_admin ───────────────────────────────────────────────────

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db
      .insert(schema.users)
      .values({
        name,
        email,
        password: passwordHash,
        role: 'super_admin',
        tenantId: null, // internal user — no tenant
      })
      .returning({ id: schema.users.id, email: schema.users.email });

    console.log(`✅ Super admin created successfully.`);
    console.log(`   ID:    ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role:  super_admin`);
    console.log('');
    console.log(
      '   You can now login at the dashboard with these credentials.',
    );

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed admin:', err);
    await client.end();
    process.exit(1);
  }
}

main();
