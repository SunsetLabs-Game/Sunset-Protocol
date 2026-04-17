<p align="center">
  <img src="assets/Sunset.png" alt="Sunset Logo" width="200"/>
</p>

<h1 align="center">Sunset</h1>

<p align="center">
  <strong>Shielded CLMM for Bitcoin wrappers and stablecoins on Conflux</strong>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Target-Conflux-orange?style=flat-square" alt="Conflux"/></a>
  <a href="#"><img src="https://img.shields.io/badge/Privacy-ZK%20Shielded-gold?style=flat-square" alt="Privacy"/></a>
  <a href="#"><img src="https://img.shields.io/badge/Focus-BTCfi%20%2B%20Stablecoins-blue?style=flat-square" alt="Focus"/></a>
  <a href="#"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"/></a>
</p>

## Overview

**Sunset** is a privacy-native concentrated liquidity market maker built around Bitcoin wrappers and stablecoin routing on Conflux.

The product thesis is:

- private swaps,
- private LP ranges,
- shielded note-based balances,
- and concentrated liquidity optimized for BTCfi and stablecoin depth.

## Core Markets

Sunset is designed around:

- `WBTC / USDT0`
- `tBTC / USDT0`
- `WBTC / USDC`
- wrapper-to-wrapper Bitcoin markets

## Design Principles

- Privacy by default through commitments, nullifiers, and zk proofs.
- Capital efficiency through CLMM price ranges instead of passive full-range liquidity.
- Bitcoin-first market design.
- Stablecoin expansion for routing, pricing, and settlement liquidity on Conflux.

## Architecture

Sunset is organized around four protocol layers:

1. Wallet and app layer for user interaction.
2. Shielded note system for private balances and positions.
3. CLMM execution layer for swaps, fee growth, and liquidity ranges.
4. Off-chain proving and relay services for privacy-preserving execution flows.

## Focus

Sunset is not a generic DEX. It is a specialized shielded liquidity venue for:

- wrapped Bitcoin,
- stablecoin routing,
- and private CLMM execution.

## Repository Map

- `frontend/`: app shell and user-facing vault UX
- `sdk/`: client logic, storage, proving glue, and protocol helpers
- `asp/`: off-chain proving and relay service
- `contracts/solidity/`: Conflux-oriented Solidity contracts for factory, range pools, and proof coordination
- `docs/conflux-migration.md`: migration and verification document

## Working Direction

The current development focus is:

- Conflux-first integration,
- Bitcoin wrapper liquidity,
- and stablecoin support including `USDT0`.

Sunset is a privacy-native concentrated liquidity market maker built around Bitcoin wrappers and stablecoin routing on Conflux.
