import { arch, cpus, platform, totalmem } from "node:os";
import { join } from "node:path";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { program } from "commander";
import Table from "cli-table";
import chalk from "chalk";
import consola from "consola";
import { info } from "./lib/packages";

const resultsPath = join(process.cwd(), "results");

program
  .option("-t, --table", "print table")
  .option("-m --markdown", "format table for markdown")
  .option("-u --update", "update README.md")
  .parse(process.argv);

const opts = program.opts();

if (opts.markdown || opts.update) {
  chalk.level = 0;
}

if (!getAvailableResults().length) {
  consola.log(chalk.red("Benchmark to gather some results to compare."));
} else if (opts.update) {
  updateReadme();
} else if (opts.table) {
  consola.log(compareResults(opts.markdown));
}

function getAvailableResults() {
  return readdirSync(resultsPath)
    .filter((file) => file.match(/(.+)\.json$/))
    .sort()
    .map((choice) => choice.replace(".json", ""));
}

function formatHasRouter(hasRouter: boolean | string) {
  return typeof hasRouter === "string" ? hasRouter : hasRouter ? "✓" : "✗";
}

function updateReadme() {
  const machineInfo = `${platform()} ${arch()} | ${cpus().length} vCPUs | ${(
    totalmem()
    / 1024 ** 3
  ).toFixed(1)}GB Mem`;
  const benchmarkMd = `# Benchmarks
* __Machine:__ ${machineInfo}
* __Node:__ \`${process.version}\`
* __Run:__ ${new Date()}
* __Method:__ \`autocannon -c 100 -d 40 -p 10 localhost:3000\` (two rounds; one to warm-up, one to measure)
${compareResults(true)}
`;
  const md = readFileSync("README.md", "utf8");
  writeFileSync("README.md", md.split("# Benchmarks")[0] + benchmarkMd, "utf8");
}

function compareResults(markdown: boolean) {
  const tableStyle = !markdown
    ? {}
    : {
        chars: {
          "top": "",
          "top-left": "",
          "top-mid": "",
          "top-right": "",
          "bottom": "",
          "bottom-left": "",
          "bottom-mid": "",
          "bottom-right": "",
          "mid": "",
          "left-mid": "",
          "mid-mid": "",
          "right-mid": "",
          "left": "|",
          "right": "|",
          "middle": "|"
        },
        style: {
          border: [],
          head: []
        }
      };

  const table = new Table({
    ...tableStyle,
    head: [
      "",
      "Version",
      "Router",
      "Requests/s",
      "Latency (ms)",
      "Throughput/Mb"
    ]
  });

  if (markdown) {
    table.push([":--", "--:", "--:", ":-:", "--:", "--:"]);
  }

  const results = getAvailableResults()
    .map((file) => {
      const content = readFileSync(`${resultsPath}/${file}.json`);
      return JSON.parse(content.toString());
    })
    .sort((a, b) => Number.parseFloat(b.requests.mean) - Number.parseFloat(a.requests.mean));

  const outputResults: any[] = [];
  const formatThroughput = (throughput: number) =>
    throughput ? (throughput / 1024 / 1024).toFixed(2) : "N/A";

  for (const result of results) {
    const beBold = result.server === "fourze";
    const { hasRouter = false, version } = info(result.server) || {};
    const {
      requests: { average: requests },
      latency: { average: latency },
      throughput: { average: throughput }
    } = result;

    outputResults.push({
      name: result.server,
      version,
      hasRouter,
      requests: requests ? requests.toFixed(1) : "N/A",
      latency: latency ? latency.toFixed(2) : "N/A",
      throughput: formatThroughput(throughput)
    });

    table.push([
      bold(beBold, chalk.blue(result.server)),
      bold(beBold, version ?? "N/A"),
      bold(beBold, formatHasRouter(hasRouter)),
      bold(beBold, requests ? requests.toFixed(1) : "N/A"),
      bold(beBold, latency ? latency.toFixed(2) : "N/A"),
      bold(beBold, throughput ? (throughput / 1024 / 1024).toFixed(2) : "N/A")
    ]);
  }
  writeFileSync(
    "benchmark-results.json",
    JSON.stringify(outputResults),
    "utf8"
  );
  return table.toString();
}

function bold(writeBold: boolean, str: string) {
  return writeBold ? chalk.bold(str) : str;
}
