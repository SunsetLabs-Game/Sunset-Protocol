pragma solidity ^0.8.28;

import {ISunsetVerifier} from "../interfaces/ISunsetVerifier.sol";
import {SunsetTypes} from "../libraries/SunsetTypes.sol";

interface IMintGroth16 {
    function verifyProof(uint256[2] calldata _pA, uint256[2][2] calldata _pB, uint256[2] calldata _pC, uint256[8] calldata _pubSignals) external view returns (bool);
}

contract MintVerifierAdapter is ISunsetVerifier {
    IMintGroth16 public verifier;

    constructor(address _verifier) {
        verifier = IMintGroth16(_verifier);
    }

    function verify(bytes calldata proofData) external view returns (bool success, bytes memory publicInputs) {
        // [changeCommitment0, changeCommitment1, root, nullifierHash0, nullifierHash1, positionCommitment, tickLower, tickUpper]
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

        SunsetTypes.MintPublicInputs memory sunsetInputs = SunsetTypes.MintPublicInputs({
            root: bytes32(pubSignals[2]),
            nullifierHash0: bytes32(pubSignals[3]),
            nullifierHash1: bytes32(pubSignals[4]),
            positionCommitment: bytes32(pubSignals[5]),
            changeCommitment0: bytes32(pubSignals[0]),
            changeCommitment1: bytes32(pubSignals[1])
        });

        publicInputs = abi.encode(sunsetInputs);
    }
}
