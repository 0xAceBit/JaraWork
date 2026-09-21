// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Create2Factory} from "./Create2Factory.sol";

/// @notice Deploys a target contract through `Create2Factory` at a deterministic address,
/// predicting the address BEFORE broadcasting and asserting the actual deployment matches.
///
/// Env vars:
///   FACTORY_ADDRESS    - address of an already-deployed Create2Factory (deploy it first via
///                        Mode 1's `deploy_contract` tool; no new tooling needed for the factory itself)
///   CREATE2_SALT        - bytes32 salt, e.g. `cast keccak "my-app-v1"` or any 0x-prefixed 32-byte value
///   CREATION_CODE       - 0x-prefixed creation bytecode of the target contract, ABI-encoded with
///                         constructor args already appended (i.e. `type(Target).creationCode`
///                         concatenated with `abi.encode(ctorArgs...)` — build this off-chain, e.g.
///                         with `cast abi-encode` + `forge inspect Target bytecode`, or inline it in a
///                         thin wrapper script that constructs `abi.encodePacked(type(Target).creationCode, abi.encode(...))`)
///   DEPLOY_VALUE        - optional wei amount to forward to the target's constructor (default 0)
///
/// `CREATE2_SALT` is read via `vm.envBytes32` directly. If you'd rather derive the salt from a
/// human-readable string, read it with `vm.envString("CREATE2_SALT_STRING")` and hash it yourself
/// (`keccak256(bytes(saltString))`) before use — either approach is fine, this script takes the
/// direct bytes32 env var because it avoids an extra hashing step for callers that already have
/// a well-formed salt.
contract DeployCreate2 is Script {
    function run() external returns (address deployedAddress) {
        address factory = vm.envAddress("FACTORY_ADDRESS");
        bytes32 salt = vm.envBytes32("CREATE2_SALT");
        bytes memory creationCode = vm.envBytes("CREATION_CODE");
        uint256 deployValue = vm.envOr("DEPLOY_VALUE", uint256(0));

        bytes32 bytecodeHash = keccak256(creationCode);
        address predicted = vm.computeCreate2Address(salt, bytecodeHash, factory);

        vm.startBroadcast();
        deployedAddress = Create2Factory(factory).deploy{value: deployValue}(salt, creationCode);
        vm.stopBroadcast();

        require(deployedAddress == predicted, "DeployCreate2: actual address did not match prediction");
    }
}
