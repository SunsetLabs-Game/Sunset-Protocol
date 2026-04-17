# Sunset Solidity Contracts

Conflux-oriented Solidity implementation for Sunset.

## Architecture

- `SunsetPoolFactory.sol`
  Creates range-specific pools with dynamic configuration and canonical token ordering.

- `SunsetRangePool.sol`
  Concentrated-liquidity pool for a single configured price band. Supports:
  public liquidity,
  public swaps,
  shielded deposits,
  shielded swaps,
  shielded withdrawals,
  protocol fee collection,
  and dynamic coordinator/fee-recipient configuration.

- `SunsetVerifierCoordinator.sol`
  Dynamic verifier registry, nullifier set, commitment log, and Merkle-root acceptance layer.

## Design choices

- No literal deployment addresses are embedded in the contracts.
- Pool deployment is fully configuration-driven.
- Token ordering is canonicalized by the factory.
- Verifier addresses, coordinator references, fee recipient, and root submitter are dynamic.
- The privacy layer is isolated from the pool math through interfaces.

## Commands

```bash
bun install
bun run compile
bun run test
bun run deploy
bun run smoke
```

Live Conflux targets:

```bash
bun run deploy:conflux
bun run smoke:conflux
```

## Deployments

Generated deployment outputs live in `deployments/`.

- Keep contract addresses dynamic and environment-driven.
- Write deploy-time metadata there rather than embedding literal addresses in source files.
- Treat the directory as generated output, not as protocol logic.
