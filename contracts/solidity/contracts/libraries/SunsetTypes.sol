// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library SunsetTypes {
    struct MembershipPublicInputs {
        bytes32 root;
        bytes32 nullifierHash;
        address recipient;
        address token;
        uint256 amount;
    }

    struct SwapPublicInputs {
        bytes32 root;
        bytes32 nullifierHash;
        bytes32 newCommitment;
        bytes32 changeCommitment;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
    }

    struct MintPublicInputs {
        bytes32 root;
        bytes32 nullifierHash0;
        bytes32 nullifierHash1;
        bytes32 positionCommitment;
        bytes32 changeCommitment0;
        bytes32 changeCommitment1;
    }

    struct BurnPublicInputs {
        bytes32 root;
        bytes32 positionNullifierHash;
        bytes32 newCommitment0;
        bytes32 newCommitment1;
    }
}
