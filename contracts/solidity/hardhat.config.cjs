require("@nomicfoundation/hardhat-ethers");
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(__dirname, ".env"));
loadEnvFile(path.join(__dirname, "../../.env.local"));
loadEnvFile(path.join(__dirname, "../../.env"));

const privateKey = process.env.PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY;
const accounts = privateKey ? [privateKey] : [];

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    hardhat: {},
    confluxESpace: {
      url: process.env.CONFLUX_RPC_URL || "https://evm.confluxrpc.com",
      chainId: 1030,
      accounts,
    },
    confluxESpaceTestnet: {
      url: process.env.CONFLUX_TESTNET_RPC_URL || "https://evmtestnet.confluxrpc.com",
      chainId: 71,
      accounts,
    },
  }
};
