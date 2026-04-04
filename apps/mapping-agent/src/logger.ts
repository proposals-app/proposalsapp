import pino from 'pino';

export function createLogger(level: string) {
  return pino({
    level,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'message',
  });
}
