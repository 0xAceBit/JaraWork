import fs from 'fs';

import {
  initiateDeveloperControlledWalletsClient,
  type Blockchain,
  type CircleDeveloperControlledWalletsClient,
  type TestnetBlockchain,
} from '@circle-fin/developer-controlled-wallets';
import {
  initiateSmartContractPlatformClient,
  type Blockchain as ScpBlockchain,
  type CircleSmartContractPlatformClient,
} from '@circle-fin/smart-contract-platform';
import { getChain } from '@circlefin/compass-chains';
import { type Abi, type Hex, createPublicClient, createWalletClient, encodeFunctionData, http, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import {
  type CompiledArtifact,
  type DeployMode,
  type SignerKind,
  DEPLOYER_PLACEHOLDER,
  assertConstructorArgs,
  assertVerifyReceiptCovers,
  buildInitcode,
  buildVerifyReceipt,
  coerceString,
  computeVerifyFingerprint,
  containsDeployerPlaceholder,
  deriveSalt,
  getForkRpcUrl,
  isRecord,
  isTransientRpcError,
  parseConstructorArgs,
  parseGasToken,
  parseMode,
  parseSignerKind,
  parseVerifyReceipt,
  predictCreate2Address,
  randomDeployerKey,
  redactRpcUrl,
  resolveRpcUrl,
  sanitizeForLog,
  substituteDeployerPlaceholder,
  validateAddress,
  validateContractName,
  verifyReceiptPath,
} from './compass-deploy-helpers';

interface ChainConfig {
  circleBlockchain: string;
  compassChain: string;
  explorer: string;
  chainLabel: string;
  gasToken: 'usdc' | 'native';
}

const ACTIVE_CHAIN: ChainConfig = {
  circleBlockchain: '',
  compassChain: '',
  explorer: '',
  chainLabel: '',
  gasToken: 'native',
};

function resolveChainDef(compassChain: string): ReturnType<typeof getChain> {
  try {
    return getChain(compassChain);
  } catch {
    throw new Error(`Unknown --compass-chain "${compassChain}". Expected a Compass chain id (e.g. Arc_Testnet, Base_Sepolia).`);
  }
}

function explorerUrlFor(address: string): string {
  return ACTIVE_CHAIN.explorer ? `${ACTIVE_CHAIN.explorer}/address/${address}` : address;
}

const WORK_DIR = '/home/user/app';
const CONTRACTS_ROOT_DIR = `${WORK_DIR}/contracts`;
const CONTRACT_SOURCES_DIR = CONTRACTS_ROOT_DIR;
const FOUNDRY_OUT_DIR = `${CONTRACTS_ROOT_DIR}/out`;
const CONTRACT_METADATA_DIR = `${CONTRACTS_ROOT_DIR}/contract-metadata`;

const CREATE2_FACTORY_ARTIFACT = `${FOUNDRY_OUT_DIR}/Create2Factory.sol/Create2Factory.json`;

const CREATE2_FACTORY_ABI = [
  {
    type: 'function',
    name: 'deploy',
    stateMutability: 'payable',
    inputs: [
      { name: 'salt', type: 'bytes32' },
      { name: 'bytecode', type: 'bytes' },
    ],
    outputs: [{ name: 'deployedAddress', type: 'address' }],
  },
] as const;

function defaultFoundryArtifactPath(contractName: string): string {
  return `${FOUNDRY_OUT_DIR}/${contractName}.sol/${contractName}.json`;
}

const FUNDING_WAIT_MS = 2_000;
const FUNDING_WAIT_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 90;

interface DeploySigner {
  address: string;
}

export interface CliOptions {
  name: string;
  constructorArgs: unknown[];
  artifactPath: string;
  mode: DeployMode;
  signerKind: SignerKind;
  walletId?: string;
  walletAddress?: string;
  factory?: string;
  skipFunding: boolean;
  skipVerifyReason?: string;
  rpcUrl: string;
}

interface DeploymentEntry {
  chain: string;
  address: string;
  explorerUrl: string;
  txHash?: string;
  deployedAt: string;
}

interface ContractMetadata {
  contractAddress: string;
  network: string;
  deployerWalletId?: string;
  deployerAddress?: string;
  contract_code_path: string;
  contract_compiled_code_path: string;
  contract_network_and_links: Record<string, string>;
  contract_deployments: DeploymentEntry[];
}

function usage(): string {
  return [
    'Usage:',
    '  bun run compass:deploy <ContractName> [constructorArgsJson] [flags]',
    '',
    '  Constructor args are a JSON array and are validated against the artifact ABI before anything',
    '  is spent. Use the literal "$DEPLOYER" for an owner/admin arg that must be the deployer wallet',
    "  (--signer dcw, --mode verify|live) — the script substitutes the wallet address once it's known,",
    '  so an owner-arg deploy no longer needs a throwaway run to discover it.',
    '',
    'Engines:',
    '  --signer dcw          (default) A′ custody path: Compass rehearses on a fork, then the',
    "                        user's DCW wallet broadcasts Create2Factory.deploy via Circle",
    '                        createContractExecutionTransaction (Circle-managed gas/nonce).',
    '  --signer private-key  path B: Compass broadcasts directly via viem with a raw key (non-custodial).',
    '                        Reads the key from DEPLOYER_PRIVATE_KEY in .env — never a flag.',
    '',
    'Flags:',
    '  --artifact <path>        Foundry artifact (default: contracts/out/<Name>.sol/<Name>.json)',
    '  --mode <fork|live|fork-then-live|verify>   default: fork-then-live',
    '',
    '  verify mode: deploys onto a fresh anvil fork through a FRESH Arc Studio Create2Factory',
    "  (not Compass's default factory), prints a ready JSON with forkRpcUrl + predictedAddress,",
    '  then stays alive (no live broadcast, no Circle creds) so a separate process can attach and',
    '  test against the same fork. Run it via execute_background, tail its redirected log for the',
    '  ready JSON, then kill_pid it when done (self-terminates after 20 minutes as a safety net).',
    "  The predicted address will NOT match a live A' deploy (different, throwaway deployer namespaces",
    '  the salt) — this verifies the factory CONTRACT and target logic, not address parity.',
    '  A successful verify writes contracts/.compass-verify/<Name>.json, which --mode live requires.',
    '',
    '  --mode live REFUSES to broadcast unless that receipt exists and still matches this contract\'s',
    '  compiled bytecode + constructor args (--mode fork-then-live is self-verifying and exempt).',
    '  Override with --skip-verify "<reason>" only when you intend to deploy unverified.',
    '  --skip-verify <reason>   deploy live without a fork-verify receipt; reason is logged',
    '  --wallet-id <id>         reuse an existing DCW wallet (dcw)',
    '  --wallet-address <addr>  address for the reused wallet',
    '  --factory <addr>         reuse an existing Create2Factory (dcw); omit to deploy one',
    '  --skip-funding           skip faucet funding (reused funded wallet)',
    '  --blockchain <enum>      REQUIRED — Circle SDK blockchain enum (e.g. ARC-TESTNET, BASE-SEPOLIA)',
    '  --compass-chain <id>     REQUIRED — Compass chain id (e.g. Arc_Testnet); resolves explorer/gas-token via the chain registry',
    '  --rpc <url>              fork + reads RPC for the target chain. Omit it and the script builds the',
    '                           keyed RPC-proxy URL from RPC_PROXY_BASE_URL / RPC_PROXY_TOKEN /',
    '                           RPC_PROXY_CHAINS in .env (required when the proxy does not cover the chain,',
    '                           and required for a --signer private-key live deploy: that path broadcasts',
    '                           through this RPC and the proxy denies eth_sendRawTransaction).',
    '  --gas-token <usdc|native>  override the registry default (usdc for USDC-gas chains, native otherwise)',
    '  --explorer <baseUrl>     override the registry explorer base URL for metadata links',
    '  --chain-label <label>    override the registry chain name used in metadata',
    '',
    'Examples (--blockchain/--compass-chain are required; Arc Testnet shown; --rpc omitted so the',
    'keyed RPC proxy in .env is used):',
    '  bun run compass:deploy SimpleToken --mode live --blockchain ARC-TESTNET --compass-chain Arc_Testnet',
    "  bun run compass:deploy SimpleToken '[\"My Token\",\"MTK\",1000000]' --mode live --blockchain ARC-TESTNET --compass-chain Arc_Testnet",
    '  bun run compass:deploy SimpleToken --mode fork --blockchain BASE-SEPOLIA --compass-chain Base_Sepolia --rpc https://sepolia.base.org',
    '  DEPLOYER_PRIVATE_KEY set in .env; bun run compass:deploy SimpleToken --signer private-key --mode live --blockchain ARC-TESTNET --compass-chain Arc_Testnet --rpc https://rpc.testnet.arc.io',
    '  bun run compass:deploy SimpleToken --mode verify --blockchain ARC-TESTNET --compass-chain Arc_Testnet > /tmp/verify.log 2>&1 &',
    '  Owner-arg contract, one shot (verify writes the receipt, live consumes it):',
    '  bun run compass:deploy MyToken \'["$DEPLOYER"]\' --mode verify --blockchain ARC-TESTNET --compass-chain Arc_Testnet',
    '  bun run compass:deploy MyToken \'["$DEPLOYER"]\' --mode live   --blockchain ARC-TESTNET --compass-chain Arc_Testnet',
    '  Mainnet (dcw only; user pre-funds the wallet — the testnet faucet cannot run there):',
    '  bun run compass:deploy SimpleToken --mode live --blockchain <MainnetEnum> --compass-chain <MainnetChainId> --wallet-id <id> --wallet-address <addr> --skip-funding',
    '',
    'Environment variables:',
    '  CIRCLE_DEVELOPER_CONTROLLED_API_KEY or CIRCLE_API_KEY or CIRCLE_SCP_API_KEY  (dcw signer only)',
    '  CIRCLE_ENTITY_SECRET or ENTITY_SECRET or CIRCLE_SCP_ENTITY_SECRET            (dcw signer only)',
    '  DEPLOYER_PRIVATE_KEY                                                         (--signer private-key live deploy)',
    '  RPC_PROXY_BASE_URL / RPC_PROXY_TOKEN / RPC_PROXY_CHAINS                      (used when --rpc is omitted)',
  ].join('\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadModule(specifier: string): Promise<Record<string, unknown>> {
  return import(specifier) as Promise<Record<string, unknown>>;
}

function requireEnv(names: string[]): string {
  for (const name of names) {
    const value = coerceString(process.env[name]);
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required environment variable. Expected one of: ${names.join(', ')}`);
}

function requireArgValue(flag: string, argv: string[], index: number): { value: string; nextIndex: number } {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }

  return { value, nextIndex: index + 1 };
}

export function parseArgs(argv: string[]): CliOptions {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const positional: string[] = [];
  let artifactPath: string | undefined;
  let mode = 'fork-then-live' as DeployMode;
  let signerKind = 'dcw' as SignerKind;
  let walletId: string | undefined;
  let walletAddress: string | undefined;
  let factory: string | undefined;
  let skipFunding = false;
  let skipVerifyReason: string | undefined;
  let rpcUrl: string | undefined;
  let blockchain: string | undefined;
  let compassChain: string | undefined;
  let gasTokenOverride: 'usdc' | 'native' | undefined;
  let explorerOverride: string | undefined;
  let chainLabelOverride: string | undefined;

  const inlineFlags: Array<[string, (value: string) => void]> = [
    ['--artifact=', (v) => (artifactPath = v)],
    ['--mode=', (v) => (mode = parseMode(v))],
    ['--signer=', (v) => (signerKind = parseSignerKind(v))],
    ['--wallet-id=', (v) => (walletId = v)],
    ['--wallet-address=', (v) => (walletAddress = validateAddress(v, '--wallet-address'))],
    ['--factory=', (v) => (factory = validateAddress(v, '--factory'))],
    ['--skip-verify=', (v) => (skipVerifyReason = v)],
    ['--rpc=', (v) => (rpcUrl = v)],
    ['--blockchain=', (v) => (blockchain = v)],
    ['--compass-chain=', (v) => (compassChain = v)],
    ['--gas-token=', (v) => (gasTokenOverride = parseGasToken(v))],
    ['--explorer=', (v) => (explorerOverride = v)],
    ['--chain-label=', (v) => (chainLabelOverride = v)],
  ];

  const spacedFlags: Record<string, (value: string) => void> = {
    '--artifact': (v) => (artifactPath = v),
    '--mode': (v) => (mode = parseMode(v)),
    '--signer': (v) => (signerKind = parseSignerKind(v)),
    '--wallet-id': (v) => (walletId = v),
    '--wallet-address': (v) => (walletAddress = validateAddress(v, '--wallet-address')),
    '--factory': (v) => (factory = validateAddress(v, '--factory')),
    '--skip-verify': (v) => (skipVerifyReason = v),
    '--rpc': (v) => (rpcUrl = v),
    '--blockchain': (v) => (blockchain = v),
    '--compass-chain': (v) => (compassChain = v),
    '--gas-token': (v) => (gasTokenOverride = parseGasToken(v)),
    '--explorer': (v) => (explorerOverride = v),
    '--chain-label': (v) => (chainLabelOverride = v),
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === '--skip-funding') {
      skipFunding = true;
      continue;
    }

    const inline = inlineFlags.find(([prefix]) => arg.startsWith(prefix));
    if (inline) {
      inline[1](arg.slice(inline[0].length));
      continue;
    }

    const spaced = spacedFlags[arg];
    if (spaced) {
      const result = requireArgValue(arg, argv, index);
      spaced(result.value);
      index = result.nextIndex;
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    positional.push(arg);
  }

  if (positional.length === 0) {
    throw new Error('Contract name is required.');
  }

  if (positional.length > 2) {
    throw new Error('Too many positional arguments.');
  }

  const name = validateContractName(positional[0]);
  const constructorArgs = parseConstructorArgs(positional[1]);

  if (walletId && !walletAddress) {
    throw new Error('--wallet-address is required when --wallet-id is provided.');
  }

  if (!blockchain) {
    throw new Error('--blockchain is required (the Circle SDK blockchain enum, e.g. ARC-TESTNET).');
  }

  if (!compassChain) {
    throw new Error('--compass-chain is required (the Compass chain id, e.g. Arc_Testnet).');
  }

  if (signerKind === 'private-key' && (mode === 'live' || mode === 'fork-then-live') && !rpcUrl) {
    throw new Error(
      '--rpc is required for a --signer private-key live deploy: that path broadcasts the raw transaction ' +
        'through --rpc, and the keyed RPC proxy the script would otherwise resolve denies eth_sendRawTransaction ' +
        '(403, and not a retriable error). Pass --rpc <broadcast-capable url>, or use the default --signer dcw, ' +
        'whose broadcast goes through Circle rather than this RPC.',
    );
  }

  const resolvedRpcUrl = resolveRpcUrl(rpcUrl, compassChain);

  const chainDef = resolveChainDef(compassChain);
  ACTIVE_CHAIN.circleBlockchain = blockchain;
  ACTIVE_CHAIN.compassChain = compassChain;
  ACTIVE_CHAIN.explorer = explorerOverride ?? chainDef.explorerUrl ?? '';
  ACTIVE_CHAIN.chainLabel = chainLabelOverride ?? chainDef.name;
  ACTIVE_CHAIN.gasToken = gasTokenOverride ?? (chainDef.nativeCurrency.symbol === 'USDC' ? 'usdc' : 'native');

  return {
    name,
    constructorArgs,
    artifactPath: artifactPath ?? defaultFoundryArtifactPath(name),
    mode,
    signerKind,
    ...(walletId ? { walletId } : {}),
    ...(walletAddress ? { walletAddress } : {}),
    ...(factory ? { factory } : {}),
    skipFunding,
    ...(skipVerifyReason ? { skipVerifyReason } : {}),
    rpcUrl: resolvedRpcUrl,
  };
}

function assertArtifactReadable(artifactPath: string): void {
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Compiled artifact not found at "${artifactPath}". Run \`cd ${WORK_DIR} && forge build\` first ` +
        `(or pass --artifact <path>).`,
    );
  }
}

export function readCompiledArtifact(artifactPath: string): CompiledArtifact {
  assertArtifactReadable(artifactPath);

  const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as unknown;

  if (!isRecord(parsed) || !Array.isArray(parsed.abi)) {
    throw new Error(`Artifact "${artifactPath}" is missing an abi array.`);
  }

  const bytecodeField = parsed.bytecode;
  const object = isRecord(bytecodeField) ? bytecodeField.object : bytecodeField;

  if (typeof object !== 'string' || !object.startsWith('0x')) {
    throw new Error(`Artifact "${artifactPath}" is missing bytecode.object (0x-prefixed creation code).`);
  }

  return { abi: parsed.abi, bytecode: object as Hex };
}

function coerceNetworkLinks(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const links: Record<string, string> = {};

  for (const [network, link] of Object.entries(value)) {
    if (typeof link === 'string' && link.trim().length > 0) {
      links[network] = link;
    }
  }

  return links;
}

export function coerceDeployments(value: unknown): DeploymentEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is DeploymentEntry =>
      isRecord(entry) &&
      typeof entry.chain === 'string' &&
      typeof entry.address === 'string' &&
      typeof entry.explorerUrl === 'string' &&
      typeof entry.deployedAt === 'string',
  );
}

function readExistingMetadata(metadataPath: string): Partial<ContractMetadata> {
  if (!fs.existsSync(metadataPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as unknown;

    if (!isRecord(parsed)) {
      return {};
    }

    return {
      contract_code_path: typeof parsed.contract_code_path === 'string' ? parsed.contract_code_path : undefined,
      contract_network_and_links: coerceNetworkLinks(parsed.contract_network_and_links),
      contract_deployments: coerceDeployments(parsed.contract_deployments),
    };
  } catch {
    return {};
  }
}

function upsertContractMetadata(input: {
  name: string;
  artifactPath: string;
  contractAddress: string;
  explorerUrl: string;
  txHash?: string;
  deployerWalletId?: string;
  deployerAddress?: string;
}): { metadataPath: string; metadata: ContractMetadata } {
  const metadataPath = `${CONTRACT_METADATA_DIR}/${input.name}.json`;
  const existing = readExistingMetadata(metadataPath);

  fs.mkdirSync(CONTRACT_METADATA_DIR, { recursive: true });

  const entry: DeploymentEntry = {
    chain: ACTIVE_CHAIN.chainLabel,
    address: input.contractAddress,
    explorerUrl: input.explorerUrl,
    ...(input.txHash ? { txHash: input.txHash } : {}),
    deployedAt: new Date().toISOString(),
  };

  const metadata: ContractMetadata = {
    contractAddress: input.contractAddress,
    network: ACTIVE_CHAIN.circleBlockchain,
    ...(input.deployerWalletId ? { deployerWalletId: input.deployerWalletId } : {}),
    ...(input.deployerAddress ? { deployerAddress: input.deployerAddress } : {}),
    contract_code_path: existing.contract_code_path ?? `${CONTRACT_SOURCES_DIR}/${input.name}.sol`,
    contract_compiled_code_path: input.artifactPath,
    contract_network_and_links: {
      ...(existing.contract_network_and_links ?? {}),
      [ACTIVE_CHAIN.chainLabel]: input.explorerUrl,
    },
    contract_deployments: [entry, ...(existing.contract_deployments ?? [])],
  };

  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  return { metadataPath, metadata };
}

function createCircleClients(): {
  walletsClient: CircleDeveloperControlledWalletsClient;
  scpClient: CircleSmartContractPlatformClient;
} {
  const apiKey = requireEnv(['CIRCLE_DEVELOPER_CONTROLLED_API_KEY', 'CIRCLE_API_KEY', 'CIRCLE_SCP_API_KEY']);
  const entitySecret = requireEnv(['CIRCLE_ENTITY_SECRET', 'ENTITY_SECRET', 'CIRCLE_SCP_ENTITY_SECRET']);

  const walletsClient = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  const scpClient = initiateSmartContractPlatformClient({ apiKey, entitySecret });

  return { walletsClient, scpClient };
}

async function createDeploymentWallet(walletsClient: CircleDeveloperControlledWalletsClient): Promise<{
  walletSetId: string;
  walletId: string;
  walletAddress: string;
}> {
  const walletSetRes = await walletsClient.createWalletSet({
    name: `studio-compass-deploy-${Date.now()}`,
  });
  const walletSetId = walletSetRes.data?.walletSet?.id;

  if (!walletSetId) {
    throw new Error('Circle did not return a wallet set id.');
  }

  const walletRes = await walletsClient.createWallets({
    accountType: 'EOA',
    blockchains: [ACTIVE_CHAIN.circleBlockchain as Blockchain],
    count: 1,
    walletSetId,
  });
  const wallet = walletRes.data?.wallets?.[0];
  const walletId = wallet?.id;
  const walletAddress = wallet?.address;

  if (!walletId || !walletAddress) {
    throw new Error('Circle did not return a wallet id and address.');
  }

  return { walletSetId, walletId, walletAddress };
}

async function requestTestnetTokens(
  walletsClient: CircleDeveloperControlledWalletsClient,
  walletAddress: string,
): Promise<void> {
  try {
    await walletsClient.requestTestnetTokens({
      address: walletAddress,
      blockchain: ACTIVE_CHAIN.circleBlockchain as TestnetBlockchain,
      ...(ACTIVE_CHAIN.gasToken === 'usdc' ? { usdc: true } : { native: true }),
    });
  } catch (error: unknown) {
    throw new Error(
      `Circle faucet request failed: ${sanitizeForLog(error)}. ` +
        `Fund ${walletAddress} with ${ACTIVE_CHAIN.chainLabel} gas (agent faucet_drip, https://faucet.circle.com, or ` +
        `https://console.circle.com/faucet), then rerun with --wallet-id, --wallet-address, and --skip-funding.`,
    );
  }
}

async function waitForFunding(
  walletsClient: CircleDeveloperControlledWalletsClient,
  walletId: string,
): Promise<unknown[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < FUNDING_WAIT_ATTEMPTS; attempt++) {
    await sleep(FUNDING_WAIT_MS);

    try {
      const balanceRes = await walletsClient.getWalletTokenBalance({ id: walletId });
      const balances = balanceRes.data?.tokenBalances ?? [];

      if (balances.length > 0) {
        return balances;
      }

      lastError = undefined;
    } catch (error: unknown) {
      lastError = error;
    }
  }

  if (lastError !== undefined) {
    console.log(
      `Warning: balance check failed on every attempt (last error after ${FUNDING_WAIT_ATTEMPTS} tries: ${sanitizeForLog(
        lastError,
      )}).`,
    );
  }

  return [];
}

async function resolveDcwWallet(
  walletsClient: CircleDeveloperControlledWalletsClient,
  options: CliOptions,
): Promise<{ walletId: string; walletAddress: string }> {
  let walletId = options.walletId;
  let walletAddress = options.walletAddress;

  if (walletId && walletAddress) {
    console.log(`Reusing wallet ${walletId} (${walletAddress})`);
  } else {
    const created = await createDeploymentWallet(walletsClient);
    walletId = created.walletId;
    walletAddress = created.walletAddress;
    console.log(`Created wallet set ${created.walletSetId}`);
    console.log(`Created deployer wallet ${walletId} (${walletAddress})`);
  }

  if (!options.skipFunding) {
    console.log(`Requesting ${ACTIVE_CHAIN.chainLabel} faucet funds for wallet ${walletId} (${walletAddress})...`);
    await requestTestnetTokens(walletsClient, walletAddress);
    const balances = await waitForFunding(walletsClient, walletId);
    console.log(
      balances.length > 0
        ? `Wallet ${walletId} has ${balances.length} reported token balance(s) after funding.`
        : 'Funding requested, but token balances are not visible yet. Continuing.',
    );
  } else {
    console.log('Skipping faucet funding.');
  }

  return { walletId, walletAddress };
}

async function buildDeploymentConfig(options: CliOptions): Promise<unknown> {
  const mod = await loadModule('@circlefin/compass-ecosystem-evm/authoring');
  const defineEvmDeployment = mod.defineEvmDeployment as (input: unknown) => unknown;
  return defineEvmDeployment({
    name: `studio-${options.name}`,
    version: '1.0.0',
    chains: [ACTIVE_CHAIN.compassChain],
    contracts: {
      [options.name]: {
        artifact: options.artifactPath,
        ...(options.constructorArgs.length > 0 ? { constructorArgs: options.constructorArgs } : {}),
      },
    },
  });
}

async function getCodeAt(rpcUrl: string, address: Hex): Promise<string> {
  const client = createPublicClient({ transport: http(rpcUrl) });
  const code = await client.request({ method: 'eth_getCode', params: [address, 'latest'] });
  return typeof code === 'string' ? code : '0x';
}

const CODE_CONFIRM_ATTEMPTS = 10;

async function waitForCodeAt(rpcUrl: string, address: Hex): Promise<string> {
  let code = await getCodeAt(rpcUrl, address);
  for (let attempt = 1; attempt < CODE_CONFIRM_ATTEMPTS && (!code || code === '0x'); attempt++) {
    await sleep(POLL_INTERVAL_MS);
    code = await getCodeAt(rpcUrl, address);
  }
  return code;
}

function readDeployedContract(result: unknown, contractName: string): { address: string; txHash?: string } {
  const contracts = isRecord(result) && Array.isArray(result.contracts) ? result.contracts : [];
  const match =
    contracts.find((c): c is Record<string, unknown> => isRecord(c) && c.name === contractName) ??
    (isRecord(contracts[0]) ? contracts[0] : undefined);

  const address = match && typeof match.address === 'string' ? match.address : undefined;

  if (!address) {
    throw new Error(`Compass deploy returned no address for ${contractName}. Raw result: ${sanitizeForLog(result)}`);
  }

  return {
    address,
    ...(match && typeof match.txHash === 'string' ? { txHash: match.txHash } : {}),
  };
}

async function runForkRehearsal(config: unknown, options: CliOptions): Promise<string | undefined> {
  const mod = await loadModule('@circlefin/compass-deploy/test-bridge');
  const dryRun = mod.dryRun as (input: unknown) => Promise<unknown>;
  const deployerKey = randomDeployerKey();
  console.log(`Fork rehearsal (L0): deploying ${options.name} on an anvil-arc fork of ${redactRpcUrl(options.rpcUrl)}...`);

  let run: unknown;

  try {
    run = await dryRun({
      config,
      forkUrls: { [ACTIVE_CHAIN.compassChain]: options.rpcUrl },
      deployerKey,
    });

    const result = isRecord(run) ? run.result : undefined;
    const { address } = readDeployedContract(result, options.name);
    console.log(`Fork rehearsal predicted CREATE2 address: ${address}`);
    return address;
  } catch (error) {
    if (options.constructorArgs.length === 0) {
      throw error;
    }

    console.warn(
      `Fork rehearsal could not run for ${options.name}: Compass's default-factory deploy does not ABI-encode ` +
        'constructor args before computing its CREATE2 address, so any non-empty constructor fails inside ' +
        'Compass rather than in your contract (traced upstream in crcl-main/compass, ' +
        'docs/proposals/evm-constructor-args-not-abi-encoded.md). The live broadcast below encodes the init code ' +
        'itself and is unaffected, and the arg arity/encoding preflight already ran — but this run has NOT been ' +
        `rehearsed on a fork. Use --mode verify for real pre-deploy verification. Detail: ${sanitizeForLog(error)}`,
    );

    return undefined;
  } finally {
    if (isRecord(run) && typeof run.shutdown === 'function') {
      await (run.shutdown as () => Promise<void>)();
    }
  }
}

const VERIFY_FORK_MAX_LIFETIME_MS = 20 * 60_000;

function writeVerifyReceipt(options: CliOptions, targetArtifact: CompiledArtifact): void {
  const receiptPath = verifyReceiptPath(CONTRACTS_ROOT_DIR, options.name);
  const fingerprint = computeVerifyFingerprint(targetArtifact, options.constructorArgs);
  const receipt = buildVerifyReceipt({
    contractName: options.name,
    chain: ACTIVE_CHAIN.compassChain,
    blockchain: ACTIVE_CHAIN.circleBlockchain,
    fingerprint,
    verifiedAt: new Date().toISOString(),
  });

  fs.mkdirSync(`${CONTRACTS_ROOT_DIR}/.compass-verify`, { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`Wrote fork-verify receipt to ${receiptPath} — a subsequent --mode live deploy will accept it.`);
}

function readVerifyReceipt(contractName: string): ReturnType<typeof parseVerifyReceipt> {
  const receiptPath = verifyReceiptPath(CONTRACTS_ROOT_DIR, contractName);

  if (!fs.existsSync(receiptPath)) {
    return undefined;
  }

  return parseVerifyReceipt(fs.readFileSync(receiptPath, 'utf8'));
}

function assertDeployerPlaceholderIsResolvable(options: CliOptions): void {
  if (!containsDeployerPlaceholder(options.constructorArgs)) {
    return;
  }

  if (options.signerKind !== 'dcw') {
    throw new Error(
      `${DEPLOYER_PLACEHOLDER} is only supported with --signer dcw — the private-key path deploys from the ` +
        'DEPLOYER_PRIVATE_KEY EOA, so pass that address literally instead.',
    );
  }

  if (options.mode !== 'verify' && options.mode !== 'live') {
    throw new Error(
      `${DEPLOYER_PLACEHOLDER} is only supported with --mode verify or --mode live, because the fork rehearsal in ` +
        `"${options.mode}" deploys from Compass's own throwaway key rather than the deployer wallet. ` +
        'Run --mode verify, then --mode live.',
    );
  }
}

const PREFLIGHT_DEPLOYER = '0x0000000000000000000000000000000000000001';

function assertConstructorArgsEncode(options: CliOptions, targetArtifact: CompiledArtifact): void {
  const args = substituteDeployerPlaceholder(options.constructorArgs, PREFLIGHT_DEPLOYER);

  if (containsDeployerPlaceholder(args)) {
    throw new Error(
      `${DEPLOYER_PLACEHOLDER} is substituted only at the top level of the constructor-arg array, and this ` +
        'invocation nests it inside an array or object. Pass the deployer address literally in that position, or ' +
        'move the placeholder to a top-level arg.',
    );
  }

  try {
    buildInitcode(targetArtifact, args);
  } catch (error) {
    throw new Error(
      `Constructor args do not ABI-encode against ${options.name}'s constructor. Left to viem this surfaces only ` +
        'after a wallet, faucet funding, and a factory deploy have all been paid for, so it fails here instead. ' +
        `Fix the args (arity already matched, so this is a type or format mismatch) and rerun. Detail: ${sanitizeForLog(error)}`,
    );
  }
}

function assertLiveDeployIsVerified(options: CliOptions, targetArtifact: CompiledArtifact): void {
  if (options.skipVerifyReason) {
    console.log(`Skipping the fork-verify gate — reason given: ${options.skipVerifyReason}`);
    return;
  }

  assertVerifyReceiptCovers(readVerifyReceipt(options.name), {
    contractName: options.name,
    chain: ACTIVE_CHAIN.compassChain,
    blockchain: ACTIVE_CHAIN.circleBlockchain,
    fingerprint: computeVerifyFingerprint(targetArtifact, options.constructorArgs),
  });

  console.log('Fork-verify receipt matches this contract and its constructor args — proceeding with the live deploy.');
}

async function verifyOnFork(options: CliOptions, targetArtifact: CompiledArtifact): Promise<void> {
  const deployerKey = randomDeployerKey();
  const forkDeployer = privateKeyToAccount(deployerKey).address;
  const config = await buildDeploymentConfig({
    ...options,
    constructorArgs: substituteDeployerPlaceholder(options.constructorArgs, forkDeployer),
  });
  console.log(`Fork verify: starting a fork of ${redactRpcUrl(options.rpcUrl)} and deploying ${options.name}...`);

  const mod = await loadModule('@circlefin/compass-deploy/test-bridge');
  const dryRun = mod.dryRun as (input: unknown) => Promise<unknown>;
  const run = await dryRun({
    config,
    forkUrls: { [ACTIVE_CHAIN.compassChain]: options.rpcUrl },
    deployerKey,
  });

  if (!isRecord(run)) {
    throw new Error('Dry-run returned an unexpected result shape.');
  }

  try {
    const compassResult = run.result;
    let compassForkAddress: string | undefined;
    try {
      compassForkAddress = readDeployedContract(compassResult, options.name).address;
      console.log(`Compass's own fork rehearsal (default factory, logic-only check) predicted: ${compassForkAddress}`);
    } catch (compassDryRunError) {
      console.warn(
        "Compass's own default-factory dry-run didn't produce an address (upstream limitation for " +
          "contracts with constructor args — see docs/proposals in the compass repo) — continuing with " +
          `Arc Studio's own fork verification below. Detail: ${sanitizeForLog(compassDryRunError)}`,
      );
    }

    const forkRpcUrl = getForkRpcUrl(run, ACTIVE_CHAIN.compassChain);

    const account = privateKeyToAccount(deployerKey);
    const walletClient = createWalletClient({ account, transport: http(forkRpcUrl) });
    const publicClient = createPublicClient({ transport: http(forkRpcUrl) });

    if ((await publicClient.getBalance({ address: account.address })) === 0n) {
      throw new Error(
        `Fork verify: Compass's dry-run left the fork deployer ${account.address} unfunded. This mode depends on ` +
          'dryRun() funding the deployerKey it is handed, which is an undocumented internal pinned to ' +
          'COMPASS_CANARY_VERSION — that pin has probably drifted. This is not a contract failure.',
      );
    }

    console.log(`Deploying Arc Studio's Create2Factory onto the fork (${forkRpcUrl})...`);
    const factoryArtifact = readCompiledArtifact(CREATE2_FACTORY_ARTIFACT);
    const factoryDeployTxHash = await walletClient.deployContract({
      abi: factoryArtifact.abi as Abi,
      bytecode: factoryArtifact.bytecode,
      account,
      chain: null,
    });
    const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryDeployTxHash });
    if (factoryReceipt.status !== 'success') {
      throw new Error(
        `Fork verify: Arc Studio's Create2Factory deployment reverted on the fork (tx ${factoryDeployTxHash}). ` +
          'This is a fork-infrastructure failure, NOT a failure of the contract under test.',
      );
    }

    const factory = factoryReceipt.contractAddress;
    if (!factory) {
      throw new Error(
        `Fork Create2Factory deployment did not return a contract address (tx ${factoryDeployTxHash}). ` +
          'This is a fork-infrastructure failure, NOT a failure of the contract under test.',
      );
    }

    const salt = deriveSalt(options.name, account.address);
    const initcode = buildInitcode(
      targetArtifact,
      substituteDeployerPlaceholder(options.constructorArgs, account.address),
    );
    const predicted = predictCreate2Address(factory, salt, initcode);

    console.log(`Broadcasting Create2Factory.deploy on the fork — predicted address ${predicted}...`);
    const factoryCallTxHash = await walletClient.writeContract({
      address: factory,
      abi: CREATE2_FACTORY_ABI,
      functionName: 'deploy',
      args: [salt, initcode],
      account,
      chain: null,
    });
    const factoryCallReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryCallTxHash });
    if (factoryCallReceipt.status !== 'success') {
      throw new Error(
        `Fork verify: Create2Factory.deploy(${options.name}) REVERTED on the fork (tx ${factoryCallTxHash}). ` +
          "This IS a contract failure — the constructor reverted with these args. Treat it as a suspected " +
          'contract bug and fix the source or the constructor args; do NOT reroute to another deploy engine, ' +
          'which would broadcast the same reverting init code with real gas.',
      );
    }

    const code = await getCodeAt(forkRpcUrl, predicted);
    if (!code || code === '0x') {
      throw new Error(
        `Fork verify: no code found at predicted address ${predicted} after a successful Create2Factory.deploy ` +
          `on the fork (tx ${factoryCallTxHash}).`,
      );
    }

    writeVerifyReceipt(options, targetArtifact);

    const readyPayload = JSON.stringify(
      {
        status: 'fork-ready',
        mode: 'verify',
        chain: ACTIVE_CHAIN.compassChain,
        forkRpcUrl,
        factory,
        salt,
        predictedAddress: predicted,
        contractName: options.name,
        artifactPath: options.artifactPath,
        deployerAddress: account.address,
        compassForkAddress,
        note:
          "This fork's throwaway deployer namespaces the salt, so predictedAddress will NOT match the live A′ " +
          "address (which namespaces by the real DCW wallet). This verifies Arc Studio's Create2Factory contract and " +
          'the target contract deploy and behave correctly, not address parity with the live deploy. ' +
          'No signing key is published: obtain every sender on this fork via anvil_impersonateAccount + ' +
          'anvil_setBalance, including deployerAddress and factory.',
      },
      null,
      2,
    );
    console.log(redactRpcUrl(readyPayload));
    console.log(
      `Fork verify ready — staying alive on ${forkRpcUrl} for the integration tester to attach. ` +
        `Kill this process (kill_pid) once testing is done; it self-terminates after ${VERIFY_FORK_MAX_LIFETIME_MS / 60_000} minutes as a safety net.`,
    );
  } catch (error) {
    if (typeof run.shutdown === 'function') {
      await (run.shutdown as () => Promise<void>)().catch((shutdownError: unknown) => {
        console.error(`Fork shutdown also failed: ${sanitizeForLog(shutdownError)}`);
      });
    }
    throw error;
  }

  const shutdownFork = async (): Promise<void> => {
    if (typeof run.shutdown === 'function') {
      await (run.shutdown as () => Promise<void>)().catch((shutdownError: unknown) => {
        console.error(`Fork shutdown failed: ${sanitizeForLog(shutdownError)}`);
      });
    }
  };

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      console.log(`Received ${signal} — shutting the verify fork down.`);
      void shutdownFork().finally(() => process.exit(0));
    });
  }

  await new Promise<void>((resolve) => setTimeout(resolve, VERIFY_FORK_MAX_LIFETIME_MS));

  await shutdownFork();
}

function liveDeployError(result: unknown, contractName: string): string | undefined {
  const contracts = isRecord(result) && Array.isArray(result.contracts) ? result.contracts : [];
  const match =
    contracts.find((c): c is Record<string, unknown> => isRecord(c) && c.name === contractName) ??
    (isRecord(contracts[0]) ? contracts[0] : undefined);

  return match && typeof match.error === 'string' && match.error.length > 0 ? match.error : undefined;
}

const LIVE_DEPLOY_MAX_ATTEMPTS = 5;

async function runLiveDeploy(
  config: unknown,
  signer: DeploySigner,
  options: CliOptions,
): Promise<{ address: string; txHash?: string }> {
  const mod = await loadModule('@circlefin/compass-deploy');
  const deploy = mod.deploy as (input: unknown) => Promise<unknown>;
  let lastError = '';

  for (let attempt = 1; attempt <= LIVE_DEPLOY_MAX_ATTEMPTS; attempt++) {
    console.log(
      attempt === 1
        ? `Live deploy (path B, viem): broadcasting ${options.name} to ${ACTIVE_CHAIN.chainLabel} via ${redactRpcUrl(options.rpcUrl)}...`
        : `Live deploy retry ${attempt}/${LIVE_DEPLOY_MAX_ATTEMPTS} (transient RPC error)...`,
    );

    const result = await deploy({
      deployment: config,
      target: 'testnet',
      signer,
      rpcOverrides: { [ACTIVE_CHAIN.compassChain]: options.rpcUrl },
      lockDir: CONTRACTS_ROOT_DIR,
      writeLockFile: true,
    });

    const errorMessage = liveDeployError(result, options.name);
    if (!errorMessage) {
      return readDeployedContract(result, options.name);
    }

    lastError = errorMessage;
    if (attempt < LIVE_DEPLOY_MAX_ATTEMPTS && isTransientRpcError(errorMessage)) {
      await sleep(attempt * 5_000);
      continue;
    }

    throw new Error(`Compass live deploy failed for ${options.name}: ${sanitizeForLog(errorMessage)}`);
  }

  throw new Error(
    `Compass live deploy failed for ${options.name} after ${LIVE_DEPLOY_MAX_ATTEMPTS} attempts: ${sanitizeForLog(lastError)}`,
  );
}

async function ensureCreate2Factory(input: {
  scpClient: CircleSmartContractPlatformClient;
  walletId: string;
  rpcUrl: string;
  factoryOverride?: string;
}): Promise<Hex> {
  if (input.factoryOverride) {
    const code = await getCodeAt(input.rpcUrl, input.factoryOverride as Hex);
    if (!code || code === '0x') {
      throw new Error(
        `--factory ${input.factoryOverride} has no code on ${ACTIVE_CHAIN.chainLabel}. ` +
          'Deploy a Create2Factory first, or omit --factory to deploy one.',
      );
    }
    console.log(`Reusing Create2Factory at ${input.factoryOverride}`);
    return input.factoryOverride as Hex;
  }

  console.log(`Deploying Create2Factory via Circle SCP (custody) on ${ACTIVE_CHAIN.chainLabel}...`);
  const artifact = readCompiledArtifact(CREATE2_FACTORY_ARTIFACT);

  const response = await input.scpClient.deployContract({
    name: 'Create2Factory',
    blockchain: ACTIVE_CHAIN.circleBlockchain as ScpBlockchain,
    walletId: input.walletId,
    abiJson: JSON.stringify(artifact.abi),
    bytecode: artifact.bytecode,
    constructorParameters: [],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  });

  const contractId = response.data?.contractId;
  if (!contractId) {
    throw new Error('Circle did not return a contract id for the Create2Factory deploy.');
  }

  const { contractAddress } = await pollForContract(input.scpClient, contractId);
  if (!contractAddress) {
    throw new Error('Create2Factory deployment completed without an address.');
  }

  console.log(`Create2Factory deployed at ${contractAddress}`);
  return contractAddress as Hex;
}

async function pollForContract(
  scpClient: CircleSmartContractPlatformClient,
  contractId: string,
): Promise<{ contractAddress?: string; txHash?: string }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const response = await scpClient.getContract({ id: contractId });
    const contract = response.data?.contract;

    if (!contract) {
      throw new Error(`Contract ${contractId} not found while polling deployment status.`);
    }

    if (contract.status === 'COMPLETE') {
      return {
        ...(contract.contractAddress ? { contractAddress: contract.contractAddress } : {}),
        ...(contract.txHash ? { txHash: contract.txHash } : {}),
      };
    }

    if (contract.status === 'FAILED') {
      const reason = contract.deploymentErrorReason ?? 'unknown';
      const details = contract.deploymentErrorDetails ?? '';
      throw new Error(`Create2Factory deployment failed: ${reason}. ${details}`.trim());
    }

    console.log(`Polling Create2Factory ${contractId}: ${contract.status ?? 'UNKNOWN'} (${attempt + 1}/${MAX_POLL_ATTEMPTS})`);
  }

  throw new Error(`Create2Factory deployment timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s.`);
}

async function broadcastFactoryDeploy(input: {
  walletsClient: CircleDeveloperControlledWalletsClient;
  walletId: string;
  factory: Hex;
  salt: Hex;
  initcode: Hex;
}): Promise<{ txHash?: string }> {
  const callData = encodeFunctionData({
    abi: CREATE2_FACTORY_ABI,
    functionName: 'deploy',
    args: [input.salt, input.initcode],
  });

  const response = await input.walletsClient.createContractExecutionTransaction({
    walletId: input.walletId,
    contractAddress: input.factory,
    callData,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  });

  const txId = response.data?.id;
  if (!txId) {
    throw new Error('Circle did not return a transaction id for the Create2Factory.deploy call.');
  }

  return pollTransaction(input.walletsClient, txId);
}

async function pollTransaction(
  walletsClient: CircleDeveloperControlledWalletsClient,
  txId: string,
): Promise<{ txHash?: string }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const response = await walletsClient.getTransaction({ id: txId });
    const transaction = response.data?.transaction;
    const state = transaction?.state;

    if (state === 'COMPLETE' || state === 'CONFIRMED') {
      return transaction?.txHash ? { txHash: transaction.txHash } : {};
    }

    if (state === 'FAILED' || state === 'CANCELLED' || state === 'DENIED') {
      throw new Error(`Create2Factory.deploy transaction ${txId} ended in state ${state}.`);
    }

    console.log(`Polling factory-deploy tx ${txId}: ${state ?? 'UNKNOWN'} (${attempt + 1}/${MAX_POLL_ATTEMPTS})`);
  }

  throw new Error(`Create2Factory.deploy transaction timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s.`);
}

async function runPrivateKeyDeploy(options: CliOptions, forkPredicted?: string): Promise<void> {
  const deployerKey = coerceString(process.env.DEPLOYER_PRIVATE_KEY);
  if (!deployerKey) {
    throw new Error(
      'DEPLOYER_PRIVATE_KEY must be set in /home/user/app/.env for a --signer private-key live deploy.',
    );
  }

  const mod = await loadModule('@circlefin/compass-deploy/evm-signing');
  const PrivateKeySigner = mod.PrivateKeySigner as new (key: Hex) => DeploySigner;
  const config = await buildDeploymentConfig(options);
  const signer = new PrivateKeySigner(deployerKey as Hex);
  const deployment = await runLiveDeploy(config, signer, options);

  if (forkPredicted && forkPredicted.toLowerCase() !== deployment.address.toLowerCase()) {
    throw new Error(
      `Live address ${deployment.address} does not match fork-rehearsed CREATE2 address ${forkPredicted}.`,
    );
  }

  const explorerUrl = explorerUrlFor(deployment.address);
  const { metadataPath, metadata } = upsertContractMetadata({
    name: options.name,
    artifactPath: options.artifactPath,
    contractAddress: deployment.address,
    explorerUrl,
    ...(deployment.txHash ? { txHash: deployment.txHash } : {}),
    deployerAddress: signer.address,
  });

  console.log(
    JSON.stringify(
      {
        status: 'success',
        mode: options.mode,
        chain: ACTIVE_CHAIN.chainLabel,
        engine: 'compass',
        signer: 'private-key',
        predictedAddress: forkPredicted,
        contractAddress: deployment.address,
        txHash: deployment.txHash,
        deployerAddress: signer.address,
        explorerUrl,
        deployLockPath: `${CONTRACTS_ROOT_DIR}/deploy.lock.json`,
        contractMetadataPath: metadataPath,
        contractMetadata: metadata,
      },
      null,
      2,
    ),
  );
}

async function runCustodyDeploy(
  options: CliOptions,
  targetArtifact: CompiledArtifact,
  forkPredicted?: string,
): Promise<void> {
  const { walletsClient, scpClient } = createCircleClients();
  const { walletId, walletAddress } = await resolveDcwWallet(walletsClient, options);

  const factory = await ensureCreate2Factory({
    scpClient,
    walletId,
    rpcUrl: options.rpcUrl,
    ...(options.factory ? { factoryOverride: options.factory } : {}),
  });

  const resolvedArgs = substituteDeployerPlaceholder(options.constructorArgs, walletAddress);
  if (options.constructorArgs.includes(DEPLOYER_PLACEHOLDER)) {
    console.log(`Substituted ${DEPLOYER_PLACEHOLDER} in the constructor args with the deployer wallet ${walletAddress}.`);
  }

  const salt = deriveSalt(options.name, walletAddress);
  const initcode = buildInitcode(targetArtifact, resolvedArgs);
  const initcodeHash = keccak256(initcode);
  const predicted = predictCreate2Address(factory, salt, initcode);

  console.log(`A′ CREATE2 prediction — factory ${factory}, salt ${salt} → ${predicted}`);
  if (forkPredicted) {
    console.log(
      `(Fork rehearsal used Compass's default factory → ${forkPredicted}; the live A′ address differs because ` +
        'it deploys through Arc Studio\'s Create2Factory. The rehearsal validated that the initcode deploys, not the address.)',
    );
  }

  const existing = await getCodeAt(options.rpcUrl, predicted);
  let txHash: string | undefined;

  if (existing && existing !== '0x') {
    console.log(`Contract already present at ${predicted} (idempotent CREATE2 re-run) — skipping broadcast.`);
  } else {
    console.log(
      `Broadcasting Create2Factory.deploy via Circle createContractExecutionTransaction (custody) on ${ACTIVE_CHAIN.chainLabel}...`,
    );
    ({ txHash } = await broadcastFactoryDeploy({ walletsClient, walletId, factory, salt, initcode }));

    const code = await waitForCodeAt(options.rpcUrl, predicted);
    if (!code || code === '0x') {
      throw new Error(
        `Broadcast completed (tx ${txHash ?? 'unknown'}) but no contract code found at the predicted CREATE2 address ${predicted} ` +
          `after ${CODE_CONFIRM_ATTEMPTS} checks. The transaction may still be pending — verify tx ${txHash ?? 'unknown'} on ${ACTIVE_CHAIN.chainLabel} before rerunning.`,
      );
    }
  }

  const explorerUrl = explorerUrlFor(predicted);
  const { metadataPath, metadata } = upsertContractMetadata({
    name: options.name,
    artifactPath: options.artifactPath,
    contractAddress: predicted,
    explorerUrl,
    ...(txHash ? { txHash } : {}),
    deployerWalletId: walletId,
    deployerAddress: walletAddress,
  });

  console.log(
    JSON.stringify(
      {
        status: 'success',
        mode: options.mode,
        chain: ACTIVE_CHAIN.chainLabel,
        engine: 'compass-rehearsal+circle-create2',
        signer: 'dcw',
        factory,
        salt,
        initcodeHash,
        predictedAddress: predicted,
        contractAddress: predicted,
        forkRehearsedAddress: forkPredicted,
        txHash,
        walletId,
        walletAddress,
        explorerUrl,
        contractMetadataPath: metadataPath,
        contractMetadata: metadata,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const targetArtifact = readCompiledArtifact(options.artifactPath);

  assertConstructorArgs(targetArtifact, options.constructorArgs, options.name);
  assertDeployerPlaceholderIsResolvable(options);
  assertConstructorArgsEncode(options, targetArtifact);

  const [deployMod, ecosystemMod] = await Promise.all([
    loadModule('@circlefin/compass-deploy'),
    loadModule('@circlefin/compass-ecosystem-evm'),
  ]);
  const registerEcosystem = deployMod.registerEcosystem as (ecosystem: unknown) => void;
  const evm = ecosystemMod.evm as () => unknown;
  registerEcosystem(evm());

  if (options.mode === 'verify') {
    await verifyOnFork(options, targetArtifact);
    return;
  }

  const runFork = options.mode === 'fork' || options.mode === 'fork-then-live';
  const runLive = options.mode === 'live' || options.mode === 'fork-then-live';

  let forkPredicted: string | undefined;
  if (runFork) {
    forkPredicted = await runForkRehearsal(await buildDeploymentConfig(options), options);
  }

  if (!runLive) {
    console.log(
      JSON.stringify(
        {
          status: 'success',
          mode: options.mode,
          chain: ACTIVE_CHAIN.chainLabel,
          signer: options.signerKind,
          forkRehearsedAddress: forkPredicted,
          forkRehearsalVerified: forkPredicted !== undefined,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (options.mode === 'live') {
    assertLiveDeployIsVerified(options, targetArtifact);
  }

  if (options.signerKind === 'private-key') {
    await runPrivateKeyDeploy(options, forkPredicted);
    return;
  }

  await runCustodyDeploy(options, targetArtifact, forkPredicted);
}

if ((import.meta as unknown as { main?: boolean }).main) {
  main().catch((error: unknown) => {
    console.error(sanitizeForLog(error));
    process.exit(1);
  });
}
