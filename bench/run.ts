import process from "node:process";
import { program } from "commander";
import inquirer from "inquirer";
import bench from "./lib/bench";
import { choices, list } from "./lib/packages";

let argv: string[] = [];

async function run() {
  const options = await getBenchmarkOptions();
  const modules = options.all ? choices : await select();
  return bench(options, modules);
}

argv = program
  .option("-t --target <module>", "module to benchmark")
  .option("-A --all", "run all modules")
  .action((command) => {
    if (command.target) {
      bench({
        all: false,
        connections: 100,
        pipelining: 10,
        duration: 40
      }, command.target);
    } else {
      return run();
    }
  })
  .parse(process.argv)
  .args;

async function parseArgv() {
  const [all, connections, pipelining, duration] = argv;
  return {
    all: all === "y",
    connections: +connections,
    pipelining: +pipelining,
    duration: +duration
  };
}

async function getBenchmarkOptions() {
  if (argv.length) {
    return parseArgv();
  }
  return inquirer.prompt([
    {
      type: "confirm",
      name: "all",
      message: "Do you want to run all benchmark tests?",
      default: true
    },
    {
      type: "input",
      name: "connections",
      message: "How many connections do you need?",
      default: 100,
      validate(value) {
        return !Number.isNaN(Number.parseFloat(value)) || "Please enter a number";
      },
      filter: Number
    },
    {
      type: "input",
      name: "pipelining",
      message: "How many pipelines do you need?",
      default: 10,
      validate(value) {
        return !Number.isNaN(Number.parseFloat(value)) || "Please enter a number";
      },
      filter: Number
    },
    {
      type: "input",
      name: "duration",
      message: "How long should it take?",
      default: 40,
      validate(value) {
        return !Number.isNaN(Number.parseFloat(value)) || "Please enter a number";
      },
      filter: Number
    }
  ]);
}

async function select() {
  const result = await inquirer.prompt([
    {
      type: "checkbox",
      message: "Select packages",
      name: "list",
      choices: [
        new inquirer.Separator(" = The usual ="),
        ...list(),
        new inquirer.Separator(" = The extras = "),
        ...list(true)
      ],
      validate(answer) {
        if (answer.length < 1) {
          return "You must choose at least one package.";
        }
        return true;
      }
    }
  ]);
  return result.list;
}
