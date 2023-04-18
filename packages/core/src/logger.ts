import type { Consola } from "consola";
import consola, { LogLevel } from "consola";

export enum FourzeLogLevel {
  Fatal = 0,
  Error = 0,
  Warn = 1,
  Log = 2,
  Info = 3,
  Success = 3,
  Debug = 4,
  Trace = 5,
  Silent = -Infinity,
  Verbose = Infinity
}

export const noopLogger = {
  log: () => {},
  info: () => {},
  success: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  debug: () => {},
  trace: () => {}
};

export type FourzeLogLevelKey = Lowercase<keyof typeof LogLevel>;

export type FourzeLogger = Consola;

let globalLoggerLevel: FourzeLogLevelKey | FourzeLogLevel = "info";

const loggerStore = new Map<string, FourzeLogger>();

export function createLogger(scope: string) {
  // return noopLogger as unknown as FourzeLogger;
  let logger = loggerStore.get(scope);
  if (!logger) {
    logger = consola.withScope(scope);
    loggerStore.set(scope, logger);
    setLoggerLevel(globalLoggerLevel, scope);
  }
  return logger;
}

export function setLoggerLevel(
  level: number | FourzeLogLevelKey,
  scope?: string
) {
  const fn = (logger: FourzeLogger) => {
    switch (level) {
      case "fatal":
      case "error":
      case LogLevel.Fatal:
      case LogLevel.Error:
        logger.level = 0;
        break;
      case "warn":
      case LogLevel.Warn:
        logger.level = 1;
        break;
      case "log":
      case LogLevel.Log:
        logger.level = 2;
        break;
      case "info":
      case "success":
      case LogLevel.Info:
      case LogLevel.Success:
        logger.level = 3;
        break;
      case "debug":
      case LogLevel.Debug:
        logger.level = 4;
        break;
      case "trace":
      case LogLevel.Trace:
        logger.level = 5;
        break;
      case "silent":
      case LogLevel.Silent:
        logger.level = -Infinity;
        break;
      case "verbose":
      case LogLevel.Verbose:
        logger.level = Infinity;
        break;
    }
  };

  if (!scope) {
    globalLoggerLevel = level;
    loggerStore.forEach(fn);
  } else {
    const logger = loggerStore.get(scope);
    if (logger) {
      fn(logger);
    }
  }
}
