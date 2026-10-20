import pino from 'pino'

export type Logger = pino.Logger

export function createLogger(service: string, level = 'info'): Logger {
  return pino({ level, base: { service } })
}
