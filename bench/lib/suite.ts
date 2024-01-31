import consola from "consola";

export async function suite(name: string, frequency: number, fn: () => void | Promise<void>) {
  const start = performance.now();
  const list = Array.from({ length: frequency }).fill(0);
  for (let i = 0; i < frequency; i++) {
    list[i] = fn();
  }
  await Promise.all(list);
  const end = performance.now();
  consola.log(`suit-${name}`, `time: ${(end - start).toFixed(3)}ms`);
}
