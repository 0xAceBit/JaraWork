import crypto from 'crypto';

import { type Abi, type Hex, encodeDeployData, getCreate2Address } from 'viem';

export type DeployMode = 'fork' | 'live' | 'fork-then-live' | 'verify';
export type SignerKind = 'dcw' | 'private-key';

export interface CompiledArtifact {
  abi: unknown[];
  bytecode: Hex;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function coerceString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function stringifyForLog(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '[unserializable]';
  }
}

const SAFE_LOG_IDENTIFIER = /^(?:0x[0-9a-fA-F]{40}|[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})$/;

export function sanitizeForLog(value: unknown): string {
  return stringifyForLog(value)
    .replace(/([?&]_rpc_token=)[^&"'\s]+/gi, '$1[redacted]')
    .replace(/\b[A-Za-z0-9+/=_-]{32,}\b/g, (m) => (SAFE_LOG_IDENTIFIER.test(m) ? m : '[redacted]'))
    .replace(/(api[_-]?key|secret|token|entity[_-]?secret)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 2_000);
}

export function redactRpcUrl(value: string): string {
  return value.replace(/([?&]_rpc_token=)[^&"'\s]+/gi, '$1[redacted]');
}

export function resolveRpcUrl(explicit: string | undefined, compassChain: string): string {
  if (explicit) {
    return explicit;
  }

  const base = coerceString(process.env.RPC_PROXY_BASE_URL);
  const token = coerceString(process.env.RPC_PROXY_TOKEN);
  const chains = (process.env.RPC_PROXY_CHAINS ?? '').split(',').map((chain) => chain.trim());

  if (base && token && chains.includes(compassChain)) {
    return `${base.replace(/\/+$/, '')}/api/rpc/${compassChain}?_rpc_token=${token}`;
  }

  throw new Error(
    `--rpc is required: no RPC_PROXY_* variables in .env cover --compass-chain "${compassChain}", ` +
      'so the keyed proxy URL cannot be built. Pass --rpc <url> explicitly.',
  );
}

export function validateContractName(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error('Contract name must be a valid Solidity identifier (letters, digits, underscores).');
  }

  return name;
}

export function validateAddress(value: string, flag: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${flag} must be a 0x-prefixed 20-byte address.`);
  }

  return value;
}

function assertNumbersSurviveJsonParse(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNumbersSurviveJsonParse(entry, `${path}[${index}]`));
    return;
  }

  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      assertNumbersSurviveJsonParse(entry, `${path}.${key}`);
    }

    return;
  }

  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error(
      `Constructor arg ${path} (${value}) is not an exact integer. JSON numbers above ` +
        `Number.MAX_SAFE_INTEGER are rounded on parse — 1000000000000000000000000 becomes ` +
        `999999999999999983222784, and nothing downstream can tell — and Solidity has no fractional types. ` +
        `Pass large integers as a decimal string instead, e.g. "1000000000000000000000000", which encodes exactly.`,
    );
  }
}

export function parseConstructorArgs(raw: string | undefined): unknown[] {
  if (!raw) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Constructor args must be a JSON array: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Constructor args must be a JSON array.');
  }

  assertNumbersSurviveJsonParse(parsed, 'args');

  return parsed;
}

export function parseMode(value: string): DeployMode {
  if (value === 'fork' || value === 'live' || value === 'fork-then-live' || value === 'verify') {
    return value;
  }

  throw new Error(`Invalid --mode "${value}". Expected fork | live | fork-then-live | verify.`);
}

export function parseSignerKind(value: string): SignerKind {
  if (value === 'dcw' || value === 'private-key') {
    return value;
  }

  throw new Error(`Invalid --signer "${value}". Expected dcw | private-key.`);
}

export function parseGasToken(value: string): 'usdc' | 'native' {
  if (value === 'usdc' || value === 'native') {
    return value;
  }

  throw new Error(`Invalid --gas-token "${value}". Expected usdc | native.`);
}

export function randomDeployerKey(): Hex {
  return `0x${crypto.randomBytes(32).toString('hex')}`;
}

export function deriveSalt(name: string, deployer: string): Hex {
  const hash = crypto.createHash('sha256').update(`origin:${deployer.toLowerCase()}:${name}`).digest('hex');
  return `0x${hash}`;
}

interface AbiConstructorInput {
  name?: string;
  type: string;
}

function abiConstructorInputs(abi: unknown[]): AbiConstructorInput[] | undefined {
  const ctor = abi.find((entry) => isRecord(entry) && entry.type === 'constructor');

  if (!isRecord(ctor)) {
    return undefined;
  }

  return Array.isArray(ctor.inputs) ? (ctor.inputs as AbiConstructorInput[]) : [];
}

function formatConstructorSignature(inputs: AbiConstructorInput[]): string {
  return `constructor(${inputs.map((i) => `${i.type}${i.name ? ` ${i.name}` : ''}`).join(', ')})`;
}

export const DEPLOYER_PLACEHOLDER = '$DEPLOYER';

export function assertConstructorArgs(
  artifact: CompiledArtifact,
  constructorArgs: unknown[],
  contractName: string,
): void {
  const inputs = abiConstructorInputs(artifact.abi);

  if (inputs === undefined) {
    if (constructorArgs.length > 0) {
      throw new Error(
        `${contractName} has no constructor in its ABI, but ${constructorArgs.length} constructor arg(s) were provided.`,
      );
    }

    return;
  }

  if (inputs.length === constructorArgs.length) {
    return;
  }

  const ownerHint = inputs.some((i) => i.type === 'address' && /owner|admin|authority/i.test(i.name ?? ''))
    ? ` The address parameter is likely the owner — pass the deployer wallet address, or ${DEPLOYER_PLACEHOLDER} to have it substituted automatically.`
    : '';

  throw new Error(
    `${contractName} expects ${inputs.length} constructor arg(s) but got ${constructorArgs.length}. ` +
      `viem does not validate this, so an omitted arg would revert on-chain after gas is spent. ` +
      `Required: ${formatConstructorSignature(inputs)}. Pass them as a JSON array, ` +
      `e.g. bun run compass:deploy ${contractName} '[...]'.${ownerHint}`,
  );
}

export function containsDeployerPlaceholder(value: unknown): boolean {
  if (value === DEPLOYER_PLACEHOLDER) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(containsDeployerPlaceholder);
  }

  if (isRecord(value)) {
    return Object.values(value).some(containsDeployerPlaceholder);
  }

  return false;
}

export function substituteDeployerPlaceholder(constructorArgs: unknown[], deployerAddress: string): unknown[] {
  return constructorArgs.map((arg) => (arg === DEPLOYER_PLACEHOLDER ? deployerAddress : arg));
}

export function buildInitcode(artifact: CompiledArtifact, constructorArgs: unknown[]): Hex {
  const abi = artifact.abi as Abi;

  return constructorArgs.length > 0
    ? encodeDeployData({ abi, bytecode: artifact.bytecode, args: constructorArgs })
    : encodeDeployData({ abi, bytecode: artifact.bytecode });
}

export function predictCreate2Address(factory: Hex, salt: Hex, initcode: Hex): Hex {
  return getCreate2Address({ from: factory, salt, bytecode: initcode });
}

export function isTransientRpcError(message: string): boolean {
  if (/revert|already deployed|insufficient funds|invalid opcode|out of gas/i.test(message)) {
    return false;
  }

  return /request limit reached|rate.?limit|\b429\b|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|fetch failed|socket hang up|\b50[23]\b|EVM adapter error|RPC[ _]?(Request failed|Error|ERROR)|network/i.test(
    message,
  );
}

export interface VerifyReceipt {
  contractName: string;
  chain: string;
  blockchain: string;
  fingerprint: string;
  verifiedAt: string;
}

export const VERIFY_RECEIPT_MAX_AGE_MS = 2 * 60 * 60_000;

export function verifyReceiptPath(contractsRootDir: string, contractName: string): string {
  return `${contractsRootDir}/.compass-verify/${contractName}.json`;
}

export function computeVerifyFingerprint(artifact: CompiledArtifact, declaredConstructorArgs: unknown[]): string {
  const payload = `${artifact.bytecode}|${JSON.stringify(declaredConstructorArgs)}`;
  return `0x${crypto.createHash('sha256').update(payload).digest('hex')}`;
}

export function buildVerifyReceipt(input: {
  contractName: string;
  chain: string;
  blockchain: string;
  fingerprint: string;
  verifiedAt: string;
}): VerifyReceipt {
  return {
    contractName: input.contractName,
    chain: input.chain,
    blockchain: input.blockchain,
    fingerprint: input.fingerprint,
    verifiedAt: input.verifiedAt,
  };
}

export function parseVerifyReceipt(raw: string): VerifyReceipt | undefined {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!isRecord(parsed)) {
    return undefined;
  }

  const { contractName, chain, blockchain, fingerprint, verifiedAt } = parsed;

  if (
    typeof contractName !== 'string' ||
    typeof chain !== 'string' ||
    typeof blockchain !== 'string' ||
    typeof fingerprint !== 'string' ||
    typeof verifiedAt !== 'string'
  ) {
    return undefined;
  }

  return { contractName, chain, blockchain, fingerprint, verifiedAt };
}

export function assertVerifyReceiptCovers(
  receipt: VerifyReceipt | undefined,
  expected: { contractName: string; chain: string; blockchain: string; fingerprint: string },
  nowMs: number = Date.now(),
): void {
  const rerun =
    `Run the fork-verify gate first:\n` +
    `  bun run compass:deploy ${expected.contractName} [ctorArgsJson] --mode verify <chain flags>\n` +
    `then re-run this live deploy. To deploy without verifying, pass --skip-verify "<reason>".`;

  if (!receipt) {
    throw new Error(`Refusing --mode live: no fork-verify receipt found for ${expected.contractName}.\n${rerun}`);
  }

  if (receipt.contractName !== expected.contractName) {
    throw new Error(
      `Refusing --mode live: the fork-verify receipt is for ${receipt.contractName}, not ${expected.contractName}.\n${rerun}`,
    );
  }

  if (receipt.chain !== expected.chain) {
    throw new Error(
      `Refusing --mode live: ${expected.contractName} was fork-verified on ${receipt.chain}, not ${expected.chain}.\n${rerun}`,
    );
  }

  if (receipt.blockchain !== expected.blockchain) {
    throw new Error(
      `Refusing --mode live: ${expected.contractName} was fork-verified with --blockchain ${receipt.blockchain}, ` +
        `not ${expected.blockchain}. The gas is spent on the --blockchain chain while every read goes to ` +
        `--compass-chain, so a mismatched pair broadcasts to one chain and confirms against another.\n${rerun}`,
    );
  }

  if (receipt.fingerprint.toLowerCase() !== expected.fingerprint.toLowerCase()) {
    throw new Error(
      `Refusing --mode live: ${expected.contractName}'s compiled bytecode or constructor args changed since it was ` +
        `fork-verified — the fork run no longer describes what you are about to deploy.\n${rerun}`,
    );
  }

  const verifiedAtMs = Date.parse(receipt.verifiedAt);

  if (!Number.isFinite(verifiedAtMs) || nowMs - verifiedAtMs > VERIFY_RECEIPT_MAX_AGE_MS) {
    throw new Error(
      `Refusing --mode live: ${expected.contractName}'s fork-verify receipt is stale (verifiedAt ` +
        `${receipt.verifiedAt}). Foundry bytecode is deterministic, so a receipt from an earlier — possibly ` +
        `abandoned — session would otherwise satisfy this gate forever; it is only accepted for ` +
        `${VERIFY_RECEIPT_MAX_AGE_MS / 60_000} minutes.\n${rerun}`,
    );
  }
}

export function getForkRpcUrl(run: Record<string, unknown>, chain: string): string {
  const forks = run.forks;

  if (!(forks instanceof Map)) {
    throw new Error('Dry-run result has no forks map — cannot locate the fork RPC URL.');
  }

  const fork = forks.get(chain) as { rpcUrl?: unknown } | undefined;

  if (!fork || typeof fork.rpcUrl !== 'string') {
    throw new Error(`No fork instance found for chain ${chain} after dry-run.`);
  }

  return fork.rpcUrl;
}
