pragma solidity ^0.8.28;

import {ISunsetVerifier} from "../interfaces/ISunsetVerifier.sol";
import {SunsetTypes} from "../libraries/SunsetTypes.sol";

interface IBurnGroth16 {
    function verifyProof(uint256[2] calldata _pA, uint256[2][2] calldata _pB, uint256[2] calldata _pC, uint256[6] calldata _pubSignals) external view returns (bool);
}

contract BurnVerifierAdapter is ISunsetVerifier {
    IBurnGroth16 public verifier;

    constructor(address _verifier) {
        verifier = IBurnGroth16(_verifier);
    }

    function verify(bytes calldata proofData) external view returns (bool success, bytes memory publicInputs) {
        // [root, positionNullifierHash, newCommitment0, newCommitment1, tickLower, tickUpper]
        (
            uint256[2] memory a, 
            uint256[2][2] memory b, 
            uint256[2] memory c, 
            uint256[6] memory pubSignals
        ) = abi.decode(proofData, (uint256[2], uint256[2][2], uint256[2], uint256[6]));

        success = verifier.verifyProof(a, b, c, pubSignals);
        if (!success) {
            return (false, "");
        }

        SunsetTypes.BurnPublicInputs memory sunsetInputs = SunsetTypes.BurnPublicInputs({
            root: bytes32(pubSignals[0]),
            positionNullifierHash: bytes32(pubSignals[1]),
            newCommitment0: bytes32(pubSignals[2]),
            newCommitment1: bytes32(pubSignals[3])
        });

        publicInputs = abi.encode(sunsetInputs);
    }
}
