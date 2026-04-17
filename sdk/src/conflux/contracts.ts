export interface SunsetContractAddresses {
  pool: string;
  coordinator: string;
}

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function assertContractAddresses(
  contracts: SunsetContractAddresses,
): SunsetContractAddresses {
  if (!isAddress(contracts.pool)) {
    throw new Error("contracts.pool must be a valid EVM address");
  }

  if (!isAddress(contracts.coordinator)) {
    throw new Error("contracts.coordinator must be a valid EVM address");
  }

  return contracts;
}
