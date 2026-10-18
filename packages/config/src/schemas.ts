import { z } from 'zod'

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0),
  )

export const appEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  APP_URL: z.url(),
  API_PORT: z.coerce.number().int().positive().default(3001),
})

export const dbEnv = z.object({
  DATABASE_URL: z.url(),
})

export const awsEnv = z.object({
  AWS_ENDPOINT_URL: z.url().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().default('bhidubot-media'),
  SQS_JOBS_QUEUE: z.string().default('bhidubot-jobs'),
  SQS_JOBS_DLQ: z.string().default('bhidubot-jobs-dlq'),
})

export const authEnv = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ALLOWED_SIGNUP_DOMAINS: csv,
})

export const smtpEnv = z.object({
  SMTP_URL: z.string().default('smtp://localhost:1025'),
  EMAIL_FROM: z.string().default('bhidubot <no-reply@bhidubot.local>'),
})

export const otelEnv = z.object({
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
})

export const apiEnvSchema = z.object({
  ...appEnv.shape,
  ...dbEnv.shape,
  ...awsEnv.shape,
  ...authEnv.shape,
  ...smtpEnv.shape,
  ...otelEnv.shape,
})

export const workerEnvSchema = z.object({
  ...appEnv.shape,
  ...dbEnv.shape,
  ...awsEnv.shape,
  ...smtpEnv.shape,
  ...otelEnv.shape,
})

export type AppEnv = z.infer<typeof appEnv>
export type DbEnv = z.infer<typeof dbEnv>
export type AwsEnv = z.infer<typeof awsEnv>
export type AuthEnv = z.infer<typeof authEnv>
export type SmtpEnv = z.infer<typeof smtpEnv>
export type OtelEnv = z.infer<typeof otelEnv>
export type ApiEnv = z.infer<typeof apiEnvSchema>
export type WorkerEnv = z.infer<typeof workerEnvSchema>
