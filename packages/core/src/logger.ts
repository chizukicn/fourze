/* eslint-disable ts/no-duplicate-enum-values */
import type { ConsolaInstance } from "consola";
import { createConsola } from "consola/core";

export enum FourzeLogLevel {
  Fatal = 0,
  Error = 0,
  Warn = 1,
  Log = 2,
  Info = 3,
  Success = 3,
  Debug = 4,
  Trace = 5,
  Silent = -1,
  Verbose = 999
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

export type FourzeLogLevelKey = Uncapitalize<keyof typeof FourzeLogLevel>;

export type FourzeLogger = ConsolaInstance;

let globalLoggerLevel: FourzeLogLevelKey | FourzeLogLevel = "fatal";

const loggerStore = new Map<string, FourzeLogger>();

export function createLogger(tag: string) {
  // return noopLogger as unknown as FourzeLogger;
  let logger = loggerStore.get(tag);
  if (!logger) {
    logger = createConsola({
    });
    loggerStore.set(tag, logger);
    setLoggerLevel(globalLoggerLevel, tag);
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
      case FourzeLogLevel.Fatal:
        logger.level = 0;
        break;
      case "warn":
      case FourzeLogLevel.Warn:
        logger.level = 1;
        break;
      case "log":
      case FourzeLogLevel.Log:
        logger.level = 2;
        break;
      case "info":
      case "success":
      case FourzeLogLevel.Success:
        logger.level = 3;
        break;
      case "debug":
      case FourzeLogLevel.Debug:
        logger.level = 4;
        break;
      case "trace":
      case FourzeLogLevel.Trace:
        logger.level = 5;
        break;
      case "silent":
      case FourzeLogLevel.Silent:
        logger.level = Number.NEGATIVE_INFINITY;
        break;
      case "verbose":
      case FourzeLogLevel.Verbose:
        logger.level = Number.POSITIVE_INFINITY;
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
