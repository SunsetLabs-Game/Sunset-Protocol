pragma solidity ^0.8.28;

import {ISunsetVerifier} from "../interfaces/ISunsetVerifier.sol";
import {SunsetTypes} from "../libraries/SunsetTypes.sol";

interface IMembershipGroth16 {
    function verifyProof(uint256[2] calldata _pA, uint256[2][2] calldata _pB, uint256[2] calldata _pC, uint256[6] calldata _pubSignals) external view returns (bool);
}

contract MembershipVerifierAdapter is ISunsetVerifier {
    IMembershipGroth16 public verifier;

    constructor(address _verifier) {
        verifier = IMembershipGroth16(_verifier);
    }

    function verify(bytes calldata proofData) external view returns (bool success, bytes memory publicInputs) {
        // [root, nullifierHash, recipient, amount_low, amount_high, token]
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

        uint256 amount = pubSignals[3] + (pubSignals[4] << 128);

        SunsetTypes.MembershipPublicInputs memory sunsetInputs = SunsetTypes.MembershipPublicInputs({
            root: bytes32(pubSignals[0]),
            nullifierHash: bytes32(pubSignals[1]),
            recipient: address(uint160(pubSignals[2])),
            token: address(uint160(pubSignals[5])),
            amount: amount
        });

        publicInputs = abi.encode(sunsetInputs);
    }
}
