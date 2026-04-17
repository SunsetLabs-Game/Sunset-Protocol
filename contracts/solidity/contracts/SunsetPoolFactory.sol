// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SunsetRangePool} from "./SunsetRangePool.sol";

contract SunsetPoolFactory is Ownable2Step {
    error PoolAlreadyExists(bytes32 poolKey);
    error InvalidTokenOrdering();

    event PoolCreated(bytes32 indexed poolKey, address indexed pool, address indexed token0, address token1);
    event DefaultCoordinatorUpdated(address indexed coordinator);
    event DefaultFeeRecipientUpdated(address indexed feeRecipient);
    event DefaultProtocolFeeUpdated(uint16 protocolFeeBps);

    address public defaultCoordinator;
    address public defaultFeeRecipient;
    uint16 public defaultProtocolFeeBps;

    mapping(bytes32 => address) public pools;

    constructor(
        address initialOwner,
        address initialCoordinator,
        address initialFeeRecipient,
        uint16 initialProtocolFeeBps
    ) Ownable(initialOwner) {
        defaultCoordinator = initialCoordinator;
        defaultFeeRecipient = initialFeeRecipient;
        defaultProtocolFeeBps = initialProtocolFeeBps;
    }

    function setDefaultCoordinator(address newCoordinator) external onlyOwner {
        defaultCoordinator = newCoordinator;
        emit DefaultCoordinatorUpdated(newCoordinator);
    }

    function setDefaultFeeRecipient(address newFeeRecipient) external onlyOwner {
        defaultFeeRecipient = newFeeRecipient;
        emit DefaultFeeRecipientUpdated(newFeeRecipient);
    }

    function setDefaultProtocolFeeBps(uint16 newProtocolFeeBps) external onlyOwner {
        defaultProtocolFeeBps = newProtocolFeeBps;
        emit DefaultProtocolFeeUpdated(newProtocolFeeBps);
    }

    function createPool(SunsetRangePool.PoolConfig memory config) external onlyOwner returns (address pool) {
        if (config.token0 >= config.token1) revert InvalidTokenOrdering();
        if (config.coordinator == address(0)) config.coordinator = defaultCoordinator;
        if (config.feeRecipient == address(0)) config.feeRecipient = defaultFeeRecipient;
        if (config.protocolFeeBps == 0) config.protocolFeeBps = defaultProtocolFeeBps;

        bytes32 poolKey = computePoolKey(config);
        if (pools[poolKey] != address(0)) revert PoolAlreadyExists(poolKey);

        pool = address(new SunsetRangePool(config, owner()));
        pools[poolKey] = pool;
        emit PoolCreated(poolKey, pool, config.token0, config.token1);
    }

    function computePoolKey(SunsetRangePool.PoolConfig memory config) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                config.token0,
                config.token1,
                config.fee,
                config.tickSpacing,
                config.tickLower,
                config.tickUpper,
                config.sqrtPriceLowerX96,
                config.sqrtPriceUpperX96
            )
        );
    }
}
