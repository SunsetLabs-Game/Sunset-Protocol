// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ISunsetVerifier} from "../interfaces/ISunsetVerifier.sol";

contract MockVerifier is ISunsetVerifier {
    bool public shouldSucceed = true;
    bytes public response;

    function setResponse(bytes calldata newResponse) external {
        response = newResponse;
    }

    function setShouldSucceed(bool nextValue) external {
        shouldSucceed = nextValue;
    }

    function verify(bytes calldata) external view returns (bool success, bytes memory publicInputs) {
        return (shouldSucceed, response);
    }
}
