import consola, { Consola } from "consola"

export const LOGGER_LEVELS = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    FATAL: 5,
    ALL: Number.MIN_VALUE,
    OFF: Number.MAX_VALUE
}

export interface FourzeLogger extends Consola {}

const loggerStore = new Map<string, FourzeLogger>()

export function createLogger(scope: string) {
    if (!loggerStore.has(scope)) {
        const logger = consola.withScope(scope)
        loggerStore.set(scope, logger)
    }
    return loggerStore.get(scope)!
}

export function setLoggerLevel(level: number | string, scope?: string) {
    if (!scope) {
        loggerStore.forEach(logger => {
            // logger.level = level
            // logger.setLevel(level)
        })
    } else {
        const logger = loggerStore.get(scope)
        if (logger) {
            // logger.level =
            //   logger.setLevel(level)
        }
    }
}
