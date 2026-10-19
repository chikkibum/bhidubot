import { integer, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const jobStatus = pgEnum('job_status', ['running', 'succeeded', 'failed'])

export const jobRuns = pgTable('job_runs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  status: jobStatus('status').notNull(),
  attempt: integer('attempt').notNull(),
  traceId: text('trace_id'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
