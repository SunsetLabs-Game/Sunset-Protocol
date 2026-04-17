# Deployment Outputs

This directory is reserved for generated deployment metadata for the Sunset Solidity contracts on Conflux.

Expected contents are produced by the deployment pipeline and must remain dynamic:

- contract address maps
- deployment manifests
- network-specific metadata
- any other generated output required by the runtime or CI

Do not hardcode protocol addresses here. Populate files from deployment scripts or environment-aware tooling.

## Supported flow

From `contracts/solidity/`:

```bash
bun run deploy
bun run smoke
```

For Conflux eSpace:

```bash
bun run deploy:conflux
bun run smoke:conflux
```

Required for live deployment:

- `CONFLUX_RPC_URL` or `CONFLUX_TESTNET_RPC_URL`
- `ADMIN_PRIVATE_KEY` or `PRIVATE_KEY`
- verifier addresses via `VERIFIER_MEMBERSHIP_ADDRESS`, `VERIFIER_SWAP_ADDRESS`, `VERIFIER_MINT_ADDRESS`, `VERIFIER_BURN_ADDRESS`

Optional:

- `DEPLOY_POOL=true` plus `TOKEN0_ADDRESS` and `TOKEN1_ADDRESS`
- `OWNER_ADDRESS`, `ROOT_SUBMITTER_ADDRESS`, `FEE_RECIPIENT_ADDRESS`
- `DEPLOY_MOCKS=true` for local or disposable environments only
