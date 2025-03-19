import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("user")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("email", "text", (col) => col.notNull().unique())
    .addColumn("emailVerified", "boolean", (col) => col.notNull())
    .addColumn("image", "text")
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("session")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("expiresAt", "timestamp", (col) => col.notNull())
    .addColumn("token", "text", (col) => col.notNull().unique())
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .addColumn("ipAddress", "text")
    .addColumn("userAgent", "text")
    .addColumn("userId", "text", (col) => col.notNull().references("user.id"))
    .execute();

  await db.schema
    .createTable("account")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("accountId", "text", (col) => col.notNull())
    .addColumn("providerId", "text", (col) => col.notNull())
    .addColumn("userId", "text", (col) => col.notNull().references("user.id"))
    .addColumn("accessToken", "text")
    .addColumn("refreshToken", "text")
    .addColumn("idToken", "text")
    .addColumn("accessTokenExpiresAt", "timestamp")
    .addColumn("refreshTokenExpiresAt", "timestamp")
    .addColumn("scope", "text")
    .addColumn("password", "text")
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("verification")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("identifier", "text", (col) => col.notNull())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("expiresAt", "timestamp", (col) => col.notNull())
    .addColumn("createdAt", "timestamp")
    .addColumn("updatedAt", "timestamp")
    .execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("verification").execute();
  await db.schema.dropTable("account").execute();
  await db.schema.dropTable("session").execute();
  await db.schema.dropTable("user").execute();
}
