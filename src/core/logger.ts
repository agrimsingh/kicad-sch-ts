// src/core/logger.ts

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

export interface LogEntry {
  level: LogLevel;
  message: string;
  name?: string;
  data?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface LoggerOptions {
  name?: string;
  level?: LogLevel;
  sink?: (entry: LogEntry) => void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 5,
  error: 4,
  warn: 3,
  info: 2,
  debug: 1,
};

function resolveDefaultLevel(): LogLevel {
  const raw = process.env.KICAD_SCH_TS_LOG_LEVEL?.toLowerCase();
  if (raw === "silent" || raw === "error" || raw === "warn" || raw === "info" || raw === "debug") {
    return raw;
  }
  return "warn";
}

function defaultSink(entry: LogEntry): void {
  const prefix = entry.name ? `[kicad-sch-ts:${entry.name}]` : "[kicad-sch-ts]";
  const dataSuffix = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
  const message = `${prefix} ${entry.message}${dataSuffix}`;

  if (entry.level === "error") {
    console.error(message);
  } else if (entry.level === "warn") {
    console.warn(message);
  } else if (entry.level === "info") {
    console.info(message);
  } else if (entry.level === "debug") {
    console.debug(message);
  }
}

function shouldLog(level: LogLevel, current: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[current] && level !== "silent";
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const name = options.name;
  const level = options.level ?? resolveDefaultLevel();
  const sink = options.sink ?? defaultSink;

  const log = (entryLevel: LogLevel, message: string, data?: Record<string, unknown>) => {
    if (!shouldLog(entryLevel, level)) {
      return;
    }
    sink({ level: entryLevel, message, name, data });
  };

  return {
    debug: (message, data) => log("debug", message, data),
    info: (message, data) => log("info", message, data),
    warn: (message, data) => log("warn", message, data),
    error: (message, data) => log("error", message, data),
  };
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
