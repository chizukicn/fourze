import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import autocannon from "autocannon";

const resultsDirectory = join(process.cwd(), "results");

const run = (opts: autocannon.Options = { url: "http://localhost:3000" }) => {
  return new Promise<any>((resolve, reject) => {
    opts.url = "http://localhost:3000";
    autocannon(opts, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

export async function fire(
  opts: autocannon.Options,
  handler: string,
  save = true
) {
  const result = await run(opts);
  if (save) {
    try {
      await access(resultsDirectory);
    } catch (e) {
      await mkdir(resultsDirectory);
    }

    result.server = handler;

    const dest = join(resultsDirectory, `${handler}.json`);
    return writeFile(dest, JSON.stringify(result));
  }
}

export type Options = autocannon.Options;
