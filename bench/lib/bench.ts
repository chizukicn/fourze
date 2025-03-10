import assert from "node:assert";
import { fork } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";
import { fire } from "./autocannon";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function doBench(opts: any, handler: string) {
  const spinner = ora(`Started ${handler}`).start();
  const forked = fork(join(__dirname, "../modules", `${handler}.js`));
  try {
    spinner.color = "magenta";
    spinner.text = `Warming ${handler}`;
    await fire(opts, handler, false);
  } catch (error) {
    return console.error(error);
  } finally {
    spinner.color = "yellow";
    spinner.text = `Working ${handler}`;
  }

  try {
    await fire(opts, handler, true);
    assert.ok(forked.kill("SIGINT"));
    spinner.text = `Results saved for ${handler}`;
    spinner.succeed();
    return true;
  } catch (error) {
    return console.error(error);
  }
}

let index = 0;
async function start(opts: any, module: string[] | string): Promise<any> {
  if (typeof module === "string") {
    module = [module];
  }

  if (module.length === index) {
    return true;
  }

  try {
    await doBench(opts, module[index]);
    index += 1;
    return start(opts, module);
  } catch (error) {
    console.error(error);
  }
}

export default start;
