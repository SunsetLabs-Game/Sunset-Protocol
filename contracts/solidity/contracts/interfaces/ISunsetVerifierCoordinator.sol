// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SunsetTypes} from "../libraries/SunsetTypes.sol";

interface ISunsetVerifierCoordinator {
    function depositCommitment(bytes32 commitment) external returns (uint32 leafIndex);
    function submitMerkleRoot(bytes32 root) external;
    function verifyMembership(bytes calldata proofData) external returns (SunsetTypes.MembershipPublicInputs memory);
    function verifySwap(bytes calldata proofData) external returns (SunsetTypes.SwapPublicInputs memory);
    function verifyMint(bytes calldata proofData) external returns (SunsetTypes.MintPublicInputs memory);
    function verifyBurn(bytes calldata proofData) external returns (SunsetTypes.BurnPublicInputs memory);
    function isNullifierSpent(bytes32 nullifierHash) external view returns (bool);
    function isKnownRoot(bytes32 root) external view returns (bool);
    function getCurrentRoot() external view returns (bytes32);
}
