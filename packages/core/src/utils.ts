import dayjs from "dayjs"

export interface Pagination {
    page?: number
    size?: number
}

export interface PaginationResult<T> {
    total: number
    page: number
    size: number
    data: T[]
}

export type DateLike = string | Date | number

export function slicePage<T>(source: T[], pagination: Pagination): PaginationResult<T> {
    const { page = 1, size = 10 } = pagination
    const total = source.length
    const data = source.slice((page - 1) * size, page * size)
    return {
        total,
        page,
        size,
        data
    }
}

export function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export function randomInt(max: number): number

export function randomInt(min: number, max: number): number

export function randomInt(min: number, max?: number) {
    if (max === undefined) {
        max = min
        min = 0
    }
    return Math.floor(Math.random() * (max - min)) + min
}

export function randomDate(start: DateLike): Date

export function randomDate(start: DateLike, end: DateLike): Date

export function randomDate(start: DateLike, end?: DateLike): Date {
    if (end === undefined) {
        end = start
        start = new Date()
    }
    const startDate = dayjs(start)
    const endDate = dayjs(end)
    return startDate.add(randomInt(endDate.diff(startDate, "day")), "day").toDate()
}

export function randomBoolean(): boolean {
    return Math.random() > 0.5
}

export function randomItem<T>(source: T[]): T {
    return source[randomInt(source.length)]
}

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

export interface Logger {
    // info
    info(...args: any[]): void
    // debug
    debug(...args: any[]): void
    // warn
    warn(...args: any[]): void
    // error
    error(...args: any[]): void
    // fatal
    fatal(...args: any[]): void
    // trace
    trace(...args: any[]): void
}

export interface FourzeLogger extends Logger {
    setLevel(level: number): void
    level: number
}

export const logger: FourzeLogger = {
    level: LOGGER_LEVELS.ALL,
    setLevel(level: number | string) {
        this.level = typeof level === "string" ? LOGGER_LEVELS[level as keyof typeof LOGGER_LEVELS] ?? 0 : level
    },
    info(...args: any[]) {
        if (this.level <= LOGGER_LEVELS.INFO) {
            console.info(`[INFO ${dayjs().format("YYYY-MM-DD HH:mm:ss")}]`, ...args)
        }
    },
    debug(...args: any[]) {
        if (this.level <= LOGGER_LEVELS.DEBUG) {
            console.debug(`[DEBUG ${dayjs().format("YYYY-MM-DD HH:mm:ss")}]`, ...args)
        }
    },
    warn(...args: any[]) {
        if (this.level <= LOGGER_LEVELS.WARN) {
            console.warn(`[WARNING ${dayjs().format("YYYY-MM-DD HH:mm:ss")}]`, ...args)
        }
    },
    trace(...args: any[]) {
        if (this.level <= LOGGER_LEVELS.TRACE) {
            console.trace(`[TRACE ${dayjs().format("YYYY-MM-DD HH:mm:ss")}]`, ...args)
        }
    },

    error(...args: any[]) {
        if (this.level <= LOGGER_LEVELS.ERROR) {
            console.error(`[ERROR ${dayjs().format("YYYY-MM-DD HH:mm:ss")}]`, ...args)
        }
    },
    fatal(...args: any[]) {
        if (this.level <= LOGGER_LEVELS.FATAL) {
            console.error(`[FATAL ${dayjs().format("YYYY-MM-DD HH:mm:ss")}]`, ...args)
        }
    }
}
