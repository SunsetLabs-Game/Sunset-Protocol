#!/usr/bin/env node

import fs from "fs";
import path from "path";

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const candidateEnvFiles = [
  path.join(ROOT_DIR, ".env.local"),
  path.join(ROOT_DIR, ".env"),
  path.join(ROOT_DIR, ".env.example"),
];

const CHAIN_ALIASES = new Map([
  ["conflux-espace", 1030n],
  ["conflux-espace-mainnet", 1030n],
  ["conflux-espace-testnet", 71n],
  ["conflux-testnet", 71n],
]);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const entries = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }
  return entries;
}

function parseChainId(rawValue) {
  if (!rawValue) return null;
  const normalized = rawValue.trim().toLowerCase();

  if (CHAIN_ALIASES.has(normalized)) {
    return CHAIN_ALIASES.get(normalized);
  }

  try {
    if (normalized.startsWith("0x")) {
      return BigInt(normalized);
    }
    if (/^\d+$/.test(normalized)) {
      return BigInt(normalized);
    }
  } catch {
    return null;
  }

  return null;
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function readPreferredEnv() {
  for (const filePath of candidateEnvFiles) {
    if (fs.existsSync(filePath)) {
      return { filePath, env: loadEnvFile(filePath) };
    }
  }
  return { filePath: null, env: {} };
}

const { filePath, env } = readPreferredEnv();
const errors = [];
const warnings = [];

if (!filePath) {
  errors.push("No root environment file found. Create .env.local from .env.example.");
}

const rpcUrl = env.VITE_RPC_URL || env.CONFLUX_RPC_URL || env.RPC_URL;
if (!rpcUrl) {
  errors.push("Missing Conflux RPC URL. Set CONFLUX_RPC_URL or VITE_RPC_URL.");
}

const chainIdRaw = env.VITE_CHAIN_ID || "0x406";
const parsedChainId = parseChainId(chainIdRaw);
if (parsedChainId === null) {
  errors.push(
    `VITE_CHAIN_ID="${chainIdRaw}" is invalid. Use 1030, 0x406, conflux-espace, 71, 0x47, or conflux-espace-testnet.`,
  );
}

for (const key of ["VITE_POOL_ADDRESS", "VITE_COORDINATOR_ADDRESS", "COORDINATOR_ADDRESS", "POOL_ADDRESS"]) {
  const value = env[key];
  if (!value) {
    warnings.push(`${key} is empty. Frontend and ASP can start, but on-chain flows will stay disconnected.`);
    continue;
  }
  if (!isAddress(value)) {
    errors.push(`${key} must be a valid EVM address. Received "${value}".`);
  }
}

const generatedFrontendEnv = path.join(ROOT_DIR, "frontend/.env.local");
const generatedAspEnv = path.join(ROOT_DIR, "asp/.env");

if (!fs.existsSync(generatedFrontendEnv) || !fs.existsSync(generatedAspEnv)) {
  warnings.push("Generated env files are missing. Run `bun run env:sync`.");
}

console.log("Conflux config check");
console.log("====================");
if (filePath) {
  console.log(`source: ${path.relative(ROOT_DIR, filePath)}`);
}
if (rpcUrl) {
  console.log(`rpc:    ${rpcUrl}`);
}
if (parsedChainId !== null) {
  console.log(`chain:  ${chainIdRaw} -> 0x${parsedChainId.toString(16)} (${parsedChainId.toString()})`);
}

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log("status: OK");
