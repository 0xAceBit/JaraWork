// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

/// @notice Minimal, reusable CREATE2 factory. Deploys arbitrary bytecode at a
/// deterministic address derived from `msg.sender` (this contract) + salt + bytecode.
/// Not tied to any specific target contract.
contract Create2Factory {
    event Deployed(address indexed deployedAddress, bytes32 indexed salt);

    /// @notice Deploys `bytecode` via CREATE2 at the address determined by `salt`.
    /// @dev Payable so the deployed contract's constructor can receive an initial ETH balance.
    function deploy(bytes32 salt, bytes memory bytecode) external payable returns (address deployedAddress) {
        deployedAddress = Create2.deploy(msg.value, salt, bytecode);
        emit Deployed(deployedAddress, salt);
    }

    /// @notice Predicts the address `deploy` would produce for a given salt + bytecode hash.
    function computeAddress(bytes32 salt, bytes32 bytecodeHash) external view returns (address) {
        return Create2.computeAddress(salt, bytecodeHash);
    }
}
