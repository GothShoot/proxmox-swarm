import pino from 'pino';
import pinoRoll from 'pino-roll';
import { logFile } from './runtime';

export function createLogger(isDaemon = false) {
  const level = process.env.LOG_LEVEL || 'info';
  if (isDaemon) {
    const destination = logFile;
    const size = process.env.SWARM_LOG_SIZE || '10m';
    const frequency = process.env.SWARM_LOG_INTERVAL || '1d';
    const transport = pinoRoll({
      file: destination,
      size,
      frequency,
      mkdir: true,
    });
    return pino({ level }, transport);
  }
  return pino({ level });
}
