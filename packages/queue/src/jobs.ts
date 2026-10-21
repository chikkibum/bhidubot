/** Job payloads by type. Later plans extend this via declaration merging. */
export interface JobMap {
  'system.ping': { note: string }
}

export type JobType = keyof JobMap

export type JobContext = { jobId: string; attempt: number; traceId: string | undefined }

export type JobHandler<K extends JobType> = (payload: JobMap[K], ctx: JobContext) => Promise<void>
