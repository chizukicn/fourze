import type { MaybeDate } from "maybe-types";
import { unique } from "./array";
import { isString, isUndef } from "./is";

export function randomInt(tmp: string): number;

export function randomInt(max: number): number;

export function randomInt(min: number, max: number): number;

/**
 *
 * @param param0  min value
 * @param max  max value
 * @returns
 */
export function randomInt(param0: number | string, max?: number) {
  let min: number;
  if (isString(param0)) {
    const [minStr, maxStr] = param0.split("-");
    min = Number.parseInt(minStr);
    max = Number.parseInt(maxStr);
  } else {
    min = param0;
  }
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return Math.floor(Math.random() * (max - min)) + min;
}

export function randomDate(start: MaybeDate): Date;

export function randomDate(start: MaybeDate, end: MaybeDate): Date;

export function randomDate(start: MaybeDate, end?: MaybeDate): Date {
  if (isUndef(end)) {
    end = start;
    start = new Date();
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  return new Date(randomInt(startDate.getTime(), endDate.getTime()));
}

export function randomBoolean(): boolean {
  return Math.random() > 0.5;
}

export function randomItem<T>(source: T[]): T;

export function randomItem<T, U>(
  source: T[],
  callback: (value: T, index: number, array: T[]) => U
): U;

export function randomItem<T, U = T>(
  source: T[],
  callback?: (value: T, index: number, array: T[]) => U
): U {
  callback = callback ?? ((value) => value as any);
  const index = randomInt(source.length);
  return callback(source[index], index, source);
}

export function randomArray<T>(
  callback: (index: number) => T,
  minLength: number,
  maxLength: number
): T[];

export function randomArray<T>(
  callback: (index: number) => T,
  maxLength: number
): T[];

export function randomArray<T>(
  callback: (index: number) => T,
  minLength: number,
  maxLength?: number
) {
  return Array.from(
    {
      length:
        isUndef(maxLength) || maxLength < minLength || minLength < 0
          ? randomInt(minLength)
          : randomInt(minLength, maxLength)
    },
    (v, k) => callback(k)
  );
}

export function randomUnique<T>(source: Iterable<T>) {
  const store = unique(source);
  return () => {
    return randomItem(store, (value, index, arr) => {
      arr.splice(index, 1);
      return value;
    });
  };
}
