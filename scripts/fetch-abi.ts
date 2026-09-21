/**
 * fetch-abi <address> [--network arc-testnet] — resolve a deployed contract's
 * ABI from a Blockscout (Arcscan) explorer and write src/contracts/<Name>.json.
 * The full ABI stays in the file; stdout gets a compact summary only, to keep
 * it out of the agent's context. Runs in-sandbox under bun.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Network registry ─────────────────────────────────────────────────

export interface NetworkConfig {
  chainId: number;
  rpc: string;
  explorerApiBase: string;
  explorerUrl: string;
  label: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  'arc-testnet': {
    chainId: 5042002,
    rpc: 'https://rpc.testnet.arc.io',
    explorerApiBase: 'https://explorer.testnet.arc.io/api',
    explorerUrl: 'https://explorer.testnet.arc.io',
    label: 'Arc Testnet',
  },
};

export const DEFAULT_NETWORK = 'arc-testnet';

const PER_FETCH_TIMEOUT_MS = 3_000;
const TOTAL_TIMEOUT_MS = 10_000;

// ── ABI types ────────────────────────────────────────────────────────

export interface AbiParam {
  name: string;
  type: string;
  indexed?: boolean;
  components?: AbiParam[];
}

export type AbiItem = Record<string, unknown>;

export interface CategorizedFunctions {
  reads: Array<{ name: string; inputs: AbiParam[]; outputs: AbiParam[] }>;
  writes: Array<{ name: string; inputs: AbiParam[]; outputs: AbiParam[]; payable: boolean }>;
  events: Array<{ name: string; inputs: AbiParam[] }>;
}

export interface ArcscanSourceResult {
  ABI?: string;
  ContractName?: string;
  IsProxy?: string;
  ImplementationAddress?: string;
}

export interface ResolveResult {
  abi: AbiItem[] | null;
  name: string | null;
  verified: boolean;
  isProxy: boolean;
  implementationAddress: string | null;
  needsExistenceCheck: boolean;
}

export interface ContractFile {
  address: string;
  chainId: number;
  name: string;
  abi: AbiItem[];
  categorized: CategorizedFunctions;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// ── Pure helpers (unit-tested) ───────────────────────────────────────

export function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export function hasContractCode(code: string | null): boolean {
  return code !== null && code !== '0x' && code !== '0x0' && code.length > 2;
}

export function sanitizeContractName(name: string | null | undefined): string {
  const cleaned = (name ?? '').replace(/[^A-Za-z0-9_]/g, '');
  if (!cleaned || /^[0-9]/.test(cleaned)) {
    return cleaned ? `Contract_${cleaned}` : 'Contract';
  }
  return cleaned;
}

function toParams(inputs: unknown): AbiParam[] {
  if (!Array.isArray(inputs)) {
    return [];
  }

  return inputs.map((raw): AbiParam => {
    const p = (raw ?? {}) as Record<string, unknown>;
    return {
      name: typeof p.name === 'string' ? p.name : '',
      type: typeof p.type === 'string' ? p.type : '',
      ...(typeof p.indexed === 'boolean' ? { indexed: p.indexed } : {}),
      ...(Array.isArray(p.components) ? { components: toParams(p.components) } : {}),
    };
  });
}

export function categorizeAbi(abi: AbiItem[]): CategorizedFunctions {
  const reads: CategorizedFunctions['reads'] = [];
  const writes: CategorizedFunctions['writes'] = [];
  const events: CategorizedFunctions['events'] = [];

  for (const item of abi) {
    const type = typeof item.type === 'string' ? item.type : '';
    const name = typeof item.name === 'string' ? item.name : '';

    if (type === 'event') {
      events.push({ name, inputs: toParams(item.inputs) });
      continue;
    }

    if (type !== 'function') {
      continue;
    }

    const mutability = typeof item.stateMutability === 'string' ? item.stateMutability : 'nonpayable';
    const inputs = toParams(item.inputs);
    const outputs = toParams(item.outputs);

    if (mutability === 'view' || mutability === 'pure') {
      reads.push({ name, inputs, outputs });
    } else {
      writes.push({ name, inputs, outputs, payable: mutability === 'payable' });
    }
  }

  reads.sort((a, b) => a.name.localeCompare(b.name));
  writes.sort((a, b) => a.name.localeCompare(b.name));
  events.sort((a, b) => a.name.localeCompare(b.name));

  return { reads, writes, events };
}

export function parseAbiJson(raw: string | null | undefined): AbiItem[] | null {
  if (!raw || raw === 'Contract source code not verified') {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AbiItem[]) : null;
  } catch {
    return null;
  }
}

export function buildContractFile(input: {
  address: string;
  chainId: number;
  name: string;
  abi: AbiItem[];
}): ContractFile {
  return {
    address: input.address,
    chainId: input.chainId,
    name: input.name,
    abi: input.abi,
    categorized: categorizeAbi(input.abi),
  };
}

// ── Explorer / RPC client (fetch injected for testability) ───────────

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSourceCode(
  net: NetworkConfig,
  address: string,
  fetchImpl: FetchLike,
): Promise<ArcscanSourceResult | null> {
  const url = `${net.explorerApiBase}?module=contract&action=getsourcecode&address=${address}`;

  try {
    const res = await fetchWithTimeout(fetchImpl, url, undefined, PER_FETCH_TIMEOUT_MS);
    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as { status?: string; result?: ArcscanSourceResult[] | null };
    if (json.status !== '1' || !json.result || json.result.length === 0) {
      return null;
    }

    return json.result[0];
  } catch {
    return null;
  }
}

export async function fetchImplementationAbi(
  net: NetworkConfig,
  address: string,
  fetchImpl: FetchLike,
): Promise<AbiItem[] | null> {
  const url = `${net.explorerApiBase}?module=contract&action=getabi&address=${address}`;

  try {
    const res = await fetchWithTimeout(fetchImpl, url, undefined, PER_FETCH_TIMEOUT_MS);
    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as { status?: string; result?: string };
    if (json.status !== '1') {
      return null;
    }

    return parseAbiJson(json.result);
  } catch {
    return null;
  }
}

export async function fetchCode(net: NetworkConfig, address: string, fetchImpl: FetchLike): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      net.rpc,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [address, 'latest'] }),
      },
      PER_FETCH_TIMEOUT_MS,
    );

    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as { result?: string };
    return typeof json.result === 'string' ? json.result : null;
  } catch {
    return null;
  }
}

export async function resolveAbi(net: NetworkConfig, address: string, fetchImpl: FetchLike): Promise<ResolveResult> {
  const source = await fetchSourceCode(net, address, fetchImpl);
  const abi = parseAbiJson(source?.ABI);

  if (!abi) {
    return {
      abi: null,
      name: source?.ContractName ?? null,
      verified: false,
      isProxy: false,
      implementationAddress: null,
      needsExistenceCheck: true,
    };
  }

  const isProxy = source?.IsProxy === 'true';
  const implementationAddress = isProxy && source?.ImplementationAddress ? source.ImplementationAddress : null;
  let resolvedAbi = abi;

  // A proxy's own ABI is just admin functions (upgradeTo, etc.); the usable
  // interface lives on the implementation contract.
  if (isProxy && implementationAddress) {
    const implAbi = await fetchImplementationAbi(net, implementationAddress, fetchImpl);
    if (implAbi) {
      resolvedAbi = implAbi;
    }
  }

  return {
    abi: resolvedAbi,
    name: source?.ContractName ?? null,
    verified: true,
    isProxy,
    implementationAddress,
    needsExistenceCheck: false,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────

interface CliOptions {
  address: string;
  network: string;
}

export function parseArgs(argv: string[]): CliOptions {
  let address: string | undefined;
  let network = DEFAULT_NETWORK;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--network') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --network');
      }
      network = value;
      i++;
      continue;
    }

    if (arg.startsWith('--network=')) {
      network = arg.slice('--network='.length);
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    if (!address) {
      address = arg;
    }
  }

  if (!address) {
    throw new Error('Usage: bun run fetch:abi <address> [--network arc-testnet]');
  }

  return { address, network };
}

export function summarize(input: {
  net: NetworkConfig;
  address: string;
  result: ResolveResult;
  categorized: CategorizedFunctions;
  writtenPath: string;
}): string {
  const { net, address, result, categorized, writtenPath } = input;
  const proxy = result.isProxy
    ? `yes -> ${result.implementationAddress ?? 'unknown'}`
    : 'no';

  return [
    `Contract: ${result.name ?? '(unnamed)'}`,
    `Network: ${net.label} (chainId ${net.chainId})`,
    `Verified: ${result.verified ? 'yes' : 'no'}`,
    `Proxy: ${proxy}`,
    `Reads: ${categorized.reads.length}  Writes: ${categorized.writes.length}  Events: ${categorized.events.length}`,
    `Explorer: ${net.explorerUrl}/address/${address}`,
    `Written: ${writtenPath}`,
  ].join('\n');
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const net = NETWORKS[options.network];

  if (!net) {
    throw new Error(
      `Unknown network "${options.network}". Supported: ${Object.keys(NETWORKS).join(', ')} (v0 is Arc Testnet only).`,
    );
  }

  const address = options.address.trim();

  if (!isAddress(address)) {
    throw new Error(`Invalid address "${address}". Expected a 0x-prefixed 40-hex-character address.`);
  }

  let totalTimer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    resolveAbi(net, address, fetch),
    new Promise<never>((_, reject) => {
      totalTimer = setTimeout(
        () => reject(new Error(`Timed out resolving ABI after ${TOTAL_TIMEOUT_MS}ms.`)),
        TOTAL_TIMEOUT_MS,
      );
    }),
  ]).finally(() => clearTimeout(totalTimer));

  if (result.abi) {
    const name = sanitizeContractName(result.name);
    const file = buildContractFile({ address, chainId: net.chainId, name, abi: result.abi });
    const outDir = path.join(process.cwd(), 'src', 'contracts');
    const outPath = path.join(outDir, `${name}.json`);
    const relPath = path.relative(process.cwd(), outPath);

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`);

    console.log(summarize({ net, address, result, categorized: file.categorized, writtenPath: relPath }));
    return;
  }

  // No verified ABI — distinguish not-found from unverified via the RPC.
  const code = await fetchCode(net, address, fetch);

  if (code === null) {
    throw new Error(
      `Could not reach ${net.label} explorer or RPC for ${address}. Try again, or paste the ABI JSON manually.`,
    );
  }

  if (!hasContractCode(code)) {
    throw new Error(
      `No contract found at ${address} on ${net.label}. v0 supports Arc Testnet only — double-check the address and network.`,
    );
  }

  console.log(
    [
      `Status: unverified — ${net.label} has no verified ABI for ${address}.`,
      `Explorer: ${net.explorerUrl}/address/${address}`,
      `Action: ask the user to paste the contract's ABI JSON, then write`,
      `  { "address": "${address}", "chainId": ${net.chainId}, "name": "Contract", "abi": [...] }`,
      `  to src/contracts/Contract.json and build the UI from it.`,
    ].join('\n'),
  );
}

// Bun sets `import.meta.main` on the entrypoint; stays dormant when imported by tests.
const invokedDirectly = (import.meta as unknown as { main?: boolean }).main === true;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
