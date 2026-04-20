<p align="center">
  <img src="assets/Sunset.png" alt="Sunset Logo" width="200"/>
</p>

<h1 align="center">Sunset</h1>

<p align="center">
  <strong>Shielded CLMM for Bitcoin wrappers and stablecoins on Conflux eSpace</strong>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Target-Conflux%20eSpace-orange?style=flat-square" alt="Conflux eSpace"/></a>
  <a href="#"><img src="https://img.shields.io/badge/Track-DeFi%20%2B%20AI-blue?style=flat-square" alt="DeFi and AI"/></a>
  <a href="#"><img src="https://img.shields.io/badge/Privacy-ZK%20Shielded-gold?style=flat-square" alt="Privacy"/></a>
  <a href="#"><img src="https://img.shields.io/badge/Focus-BTCfi%20%2B%20USDT0-green?style=flat-square" alt="BTCfi and USDT0"/></a>
</p>

## Project Overview

**Sunset** is a privacy-native concentrated liquidity market maker for Bitcoin wrappers and stablecoin routing on **Conflux eSpace**.

The protocol combines:

- shielded note balances,
- private deposits and withdrawals,
- private swap execution,
- shielded LP position management,
- and range-based liquidity for Bitcoin-heavy markets.

Sunset is designed for users who want to trade or provide liquidity in BTCfi and stablecoin pairs without exposing balances, range positions, or execution history by default.

## Why Conflux

Sunset is intentionally Conflux-first:

- it targets **Conflux eSpace** as the execution environment,
- uses an EVM-compatible deployment pipeline tailored for Conflux,
- is positioned around **USDT0** and Bitcoin wrapper liquidity,
- and is structured to support low-friction retail DeFi usage with a privacy-preserving UX.

This project aligns especially well with:

- `Best DeFi project`,
- `Best AI + Conflux integration`,
- and the optional **USDT0 integration** bonus criteria.

## Problem

Most AMMs and CLMMs leak too much information:

- swap size and path are public,
- LP ranges are public,
- balances are easy to trace,
- and strategy replication becomes trivial once an address is known.

That creates a poor environment for:

- Bitcoin treasury managers,
- active LPs,
- market makers,
- and users who want practical onchain privacy without leaving DeFi.

## Solution

Sunset introduces a shielded execution layer on top of a concentrated liquidity design.

Core ideas:

- users can move assets into shielded notes,
- zero-knowledge proofs authorize private state transitions,
- nullifiers prevent double-spends,
- commitments and Merkle roots manage shielded state,
- and CLMM mechanics preserve capital efficiency for BTCfi and stablecoin markets.

## Core Markets

Sunset is optimized around:

- `WBTC / USDT0`
- `tBTC / USDT0`
- `WBTC / USDC`
- wrapper-to-wrapper Bitcoin markets

The first submission focus is the Bitcoin-wrapper plus stablecoin vertical on Conflux, with **USDT0** as the most important settlement and routing asset.

## Architecture

The codebase is organized into four layers:

1. `frontend/`
   User-facing Conflux app for shielded deposits, swaps, withdrawals, and LP flows.
2. `sdk/`
   TypeScript client logic, note management, crypto helpers, proving glue, and protocol operations.
3. `asp/`
   Backend service for proving orchestration, Merkle synchronization, relay flow, and API endpoints.
4. `contracts/solidity/`
   Conflux-oriented Solidity contracts for factory, pool logic, verifiers, and coordinator state.

The privacy stack uses commitments, nullifiers, Merkle proofs, and circuit artifacts under `circuits/`.

## Key Features

- Shielded deposits into private notes
- Shielded withdrawals
- Shielded swaps
- Shielded liquidity provisioning and range updates
- Conflux eSpace deployment support
- Bitcoin-wrapper and stablecoin market orientation
- USDT0-first token configuration
- Off-chain proving and relay pipeline

## AI Component

Sunset includes an AI-ready coordination layer through its backend and SDK architecture, enabling agent-facing automation for privacy-preserving execution.

The current AI positioning is:

- automated strategy assistance for LP range management,
- private execution planning for shielded swaps,
- and agent-triggered transaction orchestration against Conflux-native liquidity.

This makes the project a credible candidate for the **AI + Conflux** bonus track when paired with the demo and submission narrative in [docs/hackathon/ai-positioning.md](docs/hackathon/ai-positioning.md).

## What Is Implemented

Current repository scope includes:

- a frontend application shell,
- Conflux eSpace runtime configuration,
- wallet integration with Cavos-oriented provider support,
- SDK operations for deposit, withdraw, mint, burn, and swap,
- Solidity contracts for pool factory, range pool, and verifier coordinator,
- circuits and proof-generation scripts,
- backend API handlers and sync logic,
- unit and integration tests across major modules.

## Demo Assets

Existing UI screenshots are stored in:

- [frontend/docs/screenshots/landing.png](frontend/docs/screenshots/landing.png)
- [frontend/docs/screenshots/dashboard.png](frontend/docs/screenshots/dashboard.png)
- [frontend/docs/screenshots/shield.png](frontend/docs/screenshots/shield.png)
- [frontend/docs/screenshots/swap.png](frontend/docs/screenshots/swap.png)
- [frontend/docs/screenshots/positions.png](frontend/docs/screenshots/positions.png)
- [frontend/docs/screenshots/pool.png](frontend/docs/screenshots/pool.png)
- [frontend/docs/screenshots/settings.png](frontend/docs/screenshots/settings.png)

Submission-oriented demo guidance is documented in [demo/README.md](demo/README.md).

## Hackathon Submission Pack

The repository now includes a dedicated submission pack under [docs/hackathon](docs/hackathon):

- [Submission checklist tracker](docs/hackathon/submission-checklist.md)
- [Submission playbook](docs/hackathon/submission-playbook.md)
- [Go-to-market plan](docs/hackathon/go-to-market-plan.md)
- [AI positioning](docs/hackathon/ai-positioning.md)
- [Grant proposal draft](docs/hackathon/grant-proposal.md)
- [Participant intro script](docs/hackathon/participant-intro-script.md)
- [Social post template](docs/hackathon/social-post-template.md)
- [Electric Capital PR checklist](docs/hackathon/electric-capital-checklist.md)

There is also a hackathon-repo-ready project page at [projects/sunset/README.md](projects/sunset/README.md).

## Hackathon Compliance

This repository is being prepared to match the current official Global Hackfest 2026 submission requirements:

- public GitHub repository,
- open-source license,
- setup and usage documentation,
- required go-to-market plan,
- `3 to 5 minute` demo video,
- `30 to 60 second` participant intro video,
- PR to `electric-capital/open-dev-data`,
- social post tagging `@ConfluxDevs` and `@ConfluxNetwork`,
- and a project folder under `/projects/` in the hackathon repo.

The exact operational checklist lives in [docs/hackathon/submission-checklist.md](docs/hackathon/submission-checklist.md).

## Quick Start

### Workspace

```bash
bun install
bun run env:sync
bun run check:conflux
```

### Frontend

```bash
bun run dev:frontend
```

### Backend

```bash
bun run dev:asp
```

### Full checks

```bash
bun run check
```

## Environment

Copy `.env.example` to `.env.local` and set:

- `CONFLUX_RPC_URL`
- `VITE_POOL_ADDRESS`
- `VITE_COORDINATOR_ADDRESS`
- `ADMIN_PRIVATE_KEY`
- and any token addresses for the desired Conflux environment

For frontend-only deployments, `.env.example` already includes working Conflux eSpace testnet defaults for:

- `VITE_POOL_ADDRESS`
- `VITE_COORDINATOR_ADDRESS`
- `VITE_TOKEN_0_*`
- `VITE_TOKEN_1_*`

The repository includes a validator script:

```bash
bun run check:conflux
```

## Vercel Frontend Deploy

If you only want to deploy the frontend, Vercel is enough. The ASP is not required for the app to build and load, but shielded flows that require proving or note sync will not complete without a live ASP.

Use these project settings in Vercel:

```bash
Install Command: bun install
Build Command: bun run build:frontend
Output Directory: frontend/dist
```

Recommended environment variables for Vercel using the current Conflux eSpace testnet deployment:

```bash
VITE_RPC_URL=https://evmtestnet.confluxrpc.com
VITE_ASP_URL=https://example.invalid
VITE_CHAIN_ID=71
VITE_CHAIN_NAME=Conflux eSpace Testnet
VITE_EXPLORER_URL=https://evmtestnet.confluxscan.org
VITE_POOL_ADDRESS=0xf15DBD8216F5EFfD790EEfE2ae391DeD634d99d4
VITE_COORDINATOR_ADDRESS=0xdB5ceE120dc582FB7951ABBe2850Dd6Ae8a8182c
VITE_TOKEN_0_ADDRESS=0x12A47da35FD168e2962B7E82a8f7b1e7B31A28b9
VITE_TOKEN_0_SYMBOL=WBTC
VITE_TOKEN_0_NAME=Wrapped Bitcoin
VITE_TOKEN_0_DECIMALS=8
VITE_TOKEN_1_ADDRESS=0x7C9C0Cb06D1157404852DFC592f6510516dB8296
VITE_TOKEN_1_SYMBOL=USDT0
VITE_TOKEN_1_NAME=USDT0
VITE_TOKEN_1_DECIMALS=6
```

Those values come from [contracts/solidity/deployments/contracts.json](contracts/solidity/deployments/contracts.json).

## Smart Contract Commands

```bash
cd contracts/solidity
bun install
bun run compile
bun run test
bun run deploy:conflux
bun run deploy:conflux:testnet
```

## Submission Status

This repository can satisfy most of the hackathon submission requirements directly from source control, but a few items still require manual completion outside the codebase:

- social post publication,
- PR to the official hackathon repo,
- PR to the Electric Capital ecosystem page,
- participant registration details,
- and forum submission posting.

Those are tracked explicitly in [docs/hackathon/submission-checklist.md](docs/hackathon/submission-checklist.md).

For judges reviewing this repository directly, the intended evaluation mode is repo-first: source code, setup reproducibility, screenshots, deployment addresses, and local execution.

## Team

Repository owner / submitter details should be completed before final submission:

- Team name: `Sunset Protocol`
- Sebastián Salazar ([GitHub](https://github.com/salazarsebas), Telegram: `salazarsebas`)
- Kevin Membreño ([GitHub](https://github.com/KevinMB0220))
- Josue Araya ([GitHub](https://github.com/Josue19-08))
- Contact wallet for deployment / grant flows: `0x65D6352004da8F9aBFe54E937Cde76cc85B52bdc`

## Links

- Source code: <https://github.com/SunsetLabs-Game/Sunset-Protocol>
- Hackathon project page draft: [projects/sunset/README.md](projects/sunset/README.md)
- Demo asset guide: [demo/README.md](demo/README.md)
- Conflux documentation: <https://doc.confluxnetwork.org>
- Conflux Global Hackfest repo: <https://github.com/conflux-fans/global-hackfest-2026>

## License

MIT
