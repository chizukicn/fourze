import type { MaybeArray, MaybeNumber } from "maybe-types"
import { randomInt, randomItem } from "./random"

export type BaseValueType = number | string | boolean | null | undefined

/**
 *
 * @example  "100-500" => randomInt(100, 500)
 * @example  "100" => 100
 * @example  300 => 300
 * @example  [100, 500,"600-900"] => randomItem([100,500,randomInt(600,900)])
 * @returns
 */
export function parseFakerNumber(num: MaybeArray<MaybeNumber>): number {
    if (Array.isArray(num)) {
        return parseFakerNumber(randomItem(num))
    }
    if (typeof num === "string") {
        if (num.match(/^\d+-\d+$/g)) {
            return randomInt(num)
        }
        return parseInt(num)
    }
    return num
}

export interface MockObjectOption {
    deep?: boolean
    context?: Record<string, any>
}

const transformSign = ["|", "-", "{", "}", "$"]

export function getContextValue(context: any, key: string): any {
    const keys = key.split(".")
    let value = context
    for (const k of keys) {
        if (value === undefined) {
            return undefined
        }
        value = value[k]
    }
    return value
}

export function parseFakerDynamic(val: string, context: Record<string, any>): BaseValueType {
    if (/^\d+(\-\d+)?$/g.test(val)) {
        return parseFakerNumber(val)
    }
    if (val == "true") {
        return true
    }
    if (val == "false") {
        return false
    }
    if (val === "null") {
        return null
    }
    if (val === "undefined") {
        return undefined
    }
    if (/(\w+)(\|(\w+))+/g.test(val)) {
        const value = val.split("|")
        return parseFakerDynamic(randomItem(value), context)
    }

    if (/^\w[\w\d_]*\(\)$/g.test(val)) {
        const fnName = val.slice(0, -2)
        const fn = context[fnName]
        if (typeof fn === "function") {
            return fn()
        }
    }
    if (/^\w[\w\d_]*$/g.test(val)) {
        const field = context[val]
        return field
    }

    if (/^'[^']*'$/g.test(val)) {
        return val.slice(1, -1)
    }

    if (/^"[^"]*"$/g.test(val)) {
        return val.slice(1, -1)
    }

    return val
}

export function parseFakerValue(val: string | number | boolean, context: any = {}) {
    if (typeof val === "number") {
        return val
    }

    if (typeof val == "boolean") {
        return val
    }

    if (val.match(/^\{[^}]*\}$/g)) {
        return parseFakerDynamic(val.slice(1, -1), context)
    }

    const matches = val.match(/\{[^}]*}/g)
    if (matches) {
        for (const match of matches) {
            const matchValue = match.slice(1, -1)
            val = val.replace(match, String(parseFakerDynamic(matchValue, context)))
        }
    }
    val = transformSign.reduce((rs, keyword) => {
        return rs.replaceAll(`\\${keyword}`, keyword)
    }, val)

    return val
}

/**
 *
 *  {
 * 		a :"100",
 * 		b :"300-600",
 * 		c : "8799",
 * 		d : ["100",30,"400-900"],
 * 		e : {
 * 			a :"100-300"
 * 		}
 * 	}
 *
 * @param obj
 * @param param1
 */
export function parseFakerObject(obj: MaybeArray<MaybeNumber | Record<string, any>>, options: MockObjectOption = {}): any {
    options.context = options.context ?? {}

    if (Array.isArray(obj)) {
        return obj.map(v => parseFakerObject(v, options))
    }

    if (typeof obj == "number" || typeof obj == "boolean" || typeof obj == "string") {
        return parseFakerValue(obj, options.context)
    }

    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => {
            if (Array.isArray(v)) {
                return [k, v.map(f => parseFakerObject(f, options))]
            }
            return [k, parseFakerObject(v, options)]
        })
    )
}