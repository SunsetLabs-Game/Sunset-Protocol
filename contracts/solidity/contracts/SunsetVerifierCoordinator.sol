// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ISunsetVerifier} from "./interfaces/ISunsetVerifier.sol";
import {ISunsetVerifierCoordinator} from "./interfaces/ISunsetVerifierCoordinator.sol";
import {SunsetTypes} from "./libraries/SunsetTypes.sol";

contract SunsetVerifierCoordinator is Ownable2Step, Pausable, ISunsetVerifierCoordinator {
    enum CircuitKind {
        Membership,
        Swap,
        Mint,
        Burn
    }

    error InvalidVerifier();
    error UnknownRoot(bytes32 root);
    error NullifierAlreadySpent(bytes32 nullifierHash);
    error UnauthorizedDepositor(address caller);
    error UnauthorizedRootSubmitter(address caller);
    error InvalidDecodedInputs();

    event VerifierUpdated(CircuitKind indexed circuitKind, address indexed verifier);
    event DepositorAuthorizationUpdated(address indexed account, bool authorized);
    event RootSubmitterUpdated(address indexed rootSubmitter);
    event CommitmentDeposited(bytes32 indexed commitment, uint32 indexed leafIndex);
    event MerkleRootAccepted(bytes32 indexed root);
    event NullifierSpent(bytes32 indexed nullifierHash);

    mapping(uint8 => address) public verifiers;
    mapping(bytes32 => bool) public nullifierSpent;
    mapping(bytes32 => bool) public knownRoots;
    mapping(uint32 => bytes32) public commitments;
    mapping(address => bool) public authorizedDepositors;

    address public rootSubmitter;
    bytes32 public currentRoot;
    uint32 public nextLeafIndex;

    constructor(address initialOwner, address initialRootSubmitter) Ownable(initialOwner) {
        rootSubmitter = initialRootSubmitter;
    }

    function setVerifier(CircuitKind circuitKind, address verifier) external onlyOwner {
        if (verifier == address(0)) revert InvalidVerifier();
        verifiers[uint8(circuitKind)] = verifier;
        emit VerifierUpdated(circuitKind, verifier);
    }

    function setAuthorizedDepositor(address account, bool authorized) external onlyOwner {
        authorizedDepositors[account] = authorized;
        emit DepositorAuthorizationUpdated(account, authorized);
    }

    function setRootSubmitter(address newRootSubmitter) external onlyOwner {
        rootSubmitter = newRootSubmitter;
        emit RootSubmitterUpdated(newRootSubmitter);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function depositCommitment(bytes32 commitment) external whenNotPaused returns (uint32 leafIndex) {
        if (!authorizedDepositors[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedDepositor(msg.sender);
        }

        leafIndex = nextLeafIndex++;
        commitments[leafIndex] = commitment;
        emit CommitmentDeposited(commitment, leafIndex);
    }

    function submitMerkleRoot(bytes32 root) external whenNotPaused {
        if (msg.sender != rootSubmitter && msg.sender != owner()) {
            revert UnauthorizedRootSubmitter(msg.sender);
        }

        currentRoot = root;
        knownRoots[root] = true;
        emit MerkleRootAccepted(root);
    }

    function verifyMembership(bytes calldata proofData)
        external
        whenNotPaused
        returns (SunsetTypes.MembershipPublicInputs memory inputs)
    {
        inputs = abi.decode(_verify(CircuitKind.Membership, proofData), (SunsetTypes.MembershipPublicInputs));
        _validateKnownRoot(inputs.root);
        _spendNullifier(inputs.nullifierHash);
        if (inputs.recipient == address(0) || inputs.token == address(0) || inputs.amount == 0) {
            revert InvalidDecodedInputs();
        }
    }

    function verifySwap(bytes calldata proofData)
        external
        whenNotPaused
        returns (SunsetTypes.SwapPublicInputs memory inputs)
    {
        inputs = abi.decode(_verify(CircuitKind.Swap, proofData), (SunsetTypes.SwapPublicInputs));
        _validateKnownRoot(inputs.root);
        _spendNullifier(inputs.nullifierHash);
        if (inputs.tokenIn == address(0) || inputs.tokenOut == address(0) || inputs.amountIn == 0) {
            revert InvalidDecodedInputs();
        }
        _insertCoordinatorCommitment(inputs.newCommitment);
        _insertCoordinatorCommitment(inputs.changeCommitment);
    }

    function verifyMint(bytes calldata proofData)
        external
        whenNotPaused
        returns (SunsetTypes.MintPublicInputs memory inputs)
    {
        inputs = abi.decode(_verify(CircuitKind.Mint, proofData), (SunsetTypes.MintPublicInputs));
        _validateKnownRoot(inputs.root);
        _spendNullifier(inputs.nullifierHash0);
        _spendNullifier(inputs.nullifierHash1);
        _insertCoordinatorCommitment(inputs.positionCommitment);
        _insertCoordinatorCommitment(inputs.changeCommitment0);
        _insertCoordinatorCommitment(inputs.changeCommitment1);
    }

    function verifyBurn(bytes calldata proofData)
        external
        whenNotPaused
        returns (SunsetTypes.BurnPublicInputs memory inputs)
    {
        inputs = abi.decode(_verify(CircuitKind.Burn, proofData), (SunsetTypes.BurnPublicInputs));
        _validateKnownRoot(inputs.root);
        _spendNullifier(inputs.positionNullifierHash);
        _insertCoordinatorCommitment(inputs.newCommitment0);
        _insertCoordinatorCommitment(inputs.newCommitment1);
    }

    function isNullifierSpent(bytes32 nullifierHash) external view returns (bool) {
        return nullifierSpent[nullifierHash];
    }

    function isKnownRoot(bytes32 root) external view returns (bool) {
        return knownRoots[root];
    }

    function getCurrentRoot() external view returns (bytes32) {
        return currentRoot;
    }

    function _verify(CircuitKind circuitKind, bytes calldata proofData) internal view returns (bytes memory publicInputs) {
        address verifier = verifiers[uint8(circuitKind)];
        if (verifier == address(0)) revert InvalidVerifier();

        (bool success, bytes memory decodedInputs) = ISunsetVerifier(verifier).verify(proofData);
        if (!success) revert InvalidDecodedInputs();
        return decodedInputs;
    }

    function _validateKnownRoot(bytes32 root) internal view {
        if (!knownRoots[root]) revert UnknownRoot(root);
    }

    function _spendNullifier(bytes32 nullifierHash) internal {
        if (nullifierSpent[nullifierHash]) revert NullifierAlreadySpent(nullifierHash);
        nullifierSpent[nullifierHash] = true;
        emit NullifierSpent(nullifierHash);
    }

    function _insertCoordinatorCommitment(bytes32 commitment) internal {
        uint32 leafIndex = nextLeafIndex++;
        commitments[leafIndex] = commitment;
        emit CommitmentDeposited(commitment, leafIndex);
    }
}
