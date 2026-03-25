import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.POSTGRES_URL ?? process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
export type Db = typeof db

// Re-export Drizzle utilities for convenience
export { eq, ne, gt, gte, lt, lte, and, or, not, inArray, isNull, isNotNull, desc, asc, count, sql as rawSql, ilike, like, between, arrayContains, arrayOverlaps } from 'drizzle-orm'
export * from './schema'
