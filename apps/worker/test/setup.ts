import { runMigrations } from '@bhidubot/db'

process.env.DATABASE_URL_TEST ??= 'postgres://bhidubot:bhidubot@localhost:5432/bhidubot_test'

await runMigrations(process.env.DATABASE_URL_TEST)
