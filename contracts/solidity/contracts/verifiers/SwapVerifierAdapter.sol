pragma solidity ^0.8.28;

import {ISunsetVerifier} from "../interfaces/ISunsetVerifier.sol";
import {SunsetTypes} from "../libraries/SunsetTypes.sol";

interface ISwapGroth16 {
    function verifyProof(uint256[2] calldata _pA, uint256[2][2] calldata _pB, uint256[2] calldata _pC, uint256[8] calldata _pubSignals) external view returns (bool);
}

contract SwapVerifierAdapter is ISunsetVerifier {
    ISwapGroth16 public verifier;

    constructor(address _verifier) {
        verifier = ISwapGroth16(_verifier);
    }

    function verify(bytes calldata proofData) external view returns (bool success, bytes memory publicInputs) {
        // [changeCommitment, root, nullifierHash, newCommitment, tokenIn, tokenOut, amountIn, amountOutMin]
        (
            uint256[2] memory a, 
            uint256[2][2] memory b, 
            uint256[2] memory c, 
            uint256[8] memory pubSignals
        ) = abi.decode(proofData, (uint256[2], uint256[2][2], uint256[2], uint256[8]));

        success = verifier.verifyProof(a, b, c, pubSignals);
        if (!success) {
            return (false, "");
        }

        SunsetTypes.SwapPublicInputs memory sunsetInputs = SunsetTypes.SwapPublicInputs({
            root: bytes32(pubSignals[1]),
            nullifierHash: bytes32(pubSignals[2]),
            newCommitment: bytes32(pubSignals[3]),
            changeCommitment: bytes32(pubSignals[0]),
            tokenIn: address(uint160(pubSignals[4])),
            tokenOut: address(uint160(pubSignals[5])),
            amountIn: pubSignals[6],
            amountOutMin: pubSignals[7]
        });

        publicInputs = abi.encode(sunsetInputs);
    }
}
