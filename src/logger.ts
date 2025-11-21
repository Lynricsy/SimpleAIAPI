type LogLevel = 'info' | 'warn' | 'error' | 'http' | 'debug';

const levelMeta: Record<LogLevel, { emoji: string; label: string }> = {
  info: { emoji: '✨', label: 'INFO ' },
  warn: { emoji: '⚠️', label: 'WARN ' },
  error: { emoji: '💥', label: 'ERROR' },
  http: { emoji: '🌐', label: 'HTTP ' },
  debug: { emoji: '🧩', label: 'DEBUG' },
};

const formatContext = (context?: Record<string, unknown>): string => {
  if (!context) {
    return '';
  }
  return ` | ${JSON.stringify(context)}`;
};

const log = (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
  const meta = levelMeta[level];
  const timestamp = new Date().toISOString();
  const entry = `${meta.emoji}  ${timestamp} | ${meta.label} | ${message}${formatContext(context)}`;
  if (level === 'error') {
    console.error(entry);
  } else if (level === 'warn') {
    console.warn(entry);
  } else {
    console.log(entry);
  }
};

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
  http: (message: string, context?: Record<string, unknown>) => log('http', message, context),
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
};
