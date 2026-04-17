#!/usr/bin/env node

import { spawn } from "child_process";
import path from "path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function run(command, args, label, cwd = root) {
  const child = spawn(command, args, {
    cwd,
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });

  const forward = (stream, writer) => {
    stream.on("data", (chunk) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.length > 0) {
          writer(`[${label}] ${line}\n`);
        }
      }
    });
  };

  forward(child.stdout, process.stdout.write.bind(process.stdout));
  forward(child.stderr, process.stderr.write.bind(process.stderr));
  return child;
}

const setup = run("bun", ["run", "env:sync"], "env");

setup.on("exit", (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  const check = run("bun", ["run", "check:conflux"], "check");
  check.on("exit", (checkCode) => {
    if (checkCode !== 0) {
      process.exit(checkCode ?? 1);
    }

    const frontend = run("bun", ["run", "dev"], "frontend", path.join(root, "frontend"));
    const asp = run("cargo", ["run"], "asp", path.join(root, "asp"));
    const children = [frontend, asp];

    const shutdown = (signal) => {
      for (const child of children) {
        if (!child.killed) {
          child.kill(signal);
        }
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    for (const child of children) {
      child.on("exit", (childCode) => {
        if (childCode && childCode !== 0) {
          shutdown("SIGTERM");
          process.exit(childCode);
        }
      });
    }
  });
});
