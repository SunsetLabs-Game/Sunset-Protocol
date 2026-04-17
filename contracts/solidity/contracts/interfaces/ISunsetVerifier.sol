// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ISunsetVerifier {
    function verify(bytes calldata proofData) external view returns (bool success, bytes memory publicInputs);
}
