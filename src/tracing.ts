/**
 * Transaction Tracing Instrumentation
 *
 * Patches globalThis.fetch to capture all viem http() transport RPC calls
 * and regular HTTP requests, and patches window.ethereum.request() to capture
 * EIP-1193 provider calls (e.g. eth_sendTransaction via injected wallets).
 * Events are sent to the parent frame via postMessage.
 *
 * Imported as a side-effect before any app code runs.
 * Built with Arc Studio — https://studio.arc.io
 */

// ---------------------------------------------------------------------------
// Types (inlined — sandbox can't use app module aliases)
// ---------------------------------------------------------------------------

interface TraceGroupRef { id: string; label: string; }

interface RpcTraceEvent {
  kind: 'rpc';
  id: string;
  timestamp: number;
  method: string;
  params: unknown[];
  chainId: number;
  result?: unknown;
  error?: string;
  duration?: number;
  groups?: TraceGroupRef[];
}

interface HttpTraceEvent {
  kind: 'http';
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status: number;
  duration: number;
  requestBody?: unknown;
  responseBody?: unknown;
  groups?: TraceGroupRef[];
}

interface GroupStartTraceEvent {
  kind: 'group-start';
  id: string;
  timestamp: number;
  groupId: string;
  label: string;
  groups: TraceGroupRef[];
}

interface GroupEndTraceEvent {
  kind: 'group-end';
  id: string;
  timestamp: number;
  groupId: string;
  groups: TraceGroupRef[];
}

type TraceEvent = RpcTraceEvent | HttpTraceEvent | GroupStartTraceEvent | GroupEndTraceEvent;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOG = '[studio-trace]';

function log(...args: unknown[]): void {
  console.log(LOG, ...args);
}

const MAX_BODY = 10_000;
let _counter = 0;
const _prefix = typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID().slice(0, 8)
  : Math.random().toString(36).slice(2, 10);

function id(): string {
  return `${_prefix}-${++_counter}`;
}

// ---------------------------------------------------------------------------
// Group stack — stack-based nesting for trace groups
// ---------------------------------------------------------------------------

interface GroupStackEntry { id: string; label: string; }
const _groupStack: GroupStackEntry[] = [];
let _cachedGroups: TraceGroupRef[] | null = null;

function currentGroups(): TraceGroupRef[] {
  if (!_cachedGroups) {
    _cachedGroups = _groupStack.map(g => ({ id: g.id, label: g.label }));
  }
  return _cachedGroups;
}

function invalidateGroupCache(): void {
  _cachedGroups = null;
}

interface StudioTraceAPI {
  startGroup: (label: string) => string;
  endGroup: () => void;
}

function setupTraceAPI(): void {
  const api: StudioTraceAPI = {
    startGroup(label: string): string {
      const groupId = id();
      const groups = currentGroups();
      _groupStack.push({ id: groupId, label });
      invalidateGroupCache();
      if (_enabled) {
        emit({ kind: 'group-start', id: id(), timestamp: Date.now(), groupId, label, groups });
      }
      return groupId;
    },
    endGroup(): void {
      const entry = _groupStack.pop();
      invalidateGroupCache();
      if (!entry) {
        log('endGroup called with empty stack — ignoring');
        return;
      }
      if (_enabled) {
        emit({ kind: 'group-end', id: id(), timestamp: Date.now(), groupId: entry.id, groups: currentGroups() });
      }
    },
  };
  (window as unknown as { __studioTrace: StudioTraceAPI }).__studioTrace = api;
}

setupTraceAPI();

// ---------------------------------------------------------------------------
// emitWithGroups — attaches current group ancestry to RPC/HTTP events
// ---------------------------------------------------------------------------

function emitWithGroups(event: RpcTraceEvent | HttpTraceEvent): void {
  const groups = currentGroups();
  emit(groups.length > 0 ? { ...event, groups } : event);
}

/**
 * Resolve the parent frame's origin for targeted postMessage.
 * Falls back to '*' only if the origin cannot be determined.
 */
const _parentOrigin: string = (() => {
  try {
    // ancestorOrigins is available in Chromium and Safari
    if (window.location.ancestorOrigins?.length) {
      return window.location.ancestorOrigins[0];
    }
  } catch { /* sandboxed iframe may throw */ }

  try {
    if (document.referrer) {
      return new URL(document.referrer).origin;
    }
  } catch { /* malformed referrer */ }

  return '*';
})();

function emit(event: TraceEvent): void {
  try {
    window.parent.postMessage({ type: 'studio-trace-event', event }, _parentOrigin);
  } catch {
    /* ignore */
  }
}

function truncate(s: string): string {
  return s.length > MAX_BODY ? s.slice(0, MAX_BODY) : s;
}

function tryJson(v: unknown): unknown {
  if (typeof v !== 'string') {
    return v;
  }

  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

function stringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function parseChainId(raw: unknown): number {
  if (typeof raw === 'number') {
    return raw;
  }

  if (typeof raw === 'string') {
    const n = raw.startsWith('0x') ? parseInt(raw, 16) : parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Opt-in/opt-out — parent frame controls whether tracing is active
// ---------------------------------------------------------------------------

let _enabled = false;

window.addEventListener('message', (e: MessageEvent<MessageData>) => {
  if (e.source !== window.parent) {
    return;
  }

  if (e.data?.type === 'studio-trace-config') {
    _enabled = !!e.data.enabled;
    log('tracing', _enabled ? 'enabled' : 'disabled');
  }
});

const NOISE = ['/_vite/', '/@vite/', '/@id/', '/node_modules/.vite/', 'chrome-extension://', 'localhost:5173'];

function isNoise(url: string): boolean {
  return NOISE.some((p) => url.includes(p));
}

// ---------------------------------------------------------------------------
// ChainId: learn from responses, keyed by RPC URL hostname
// ---------------------------------------------------------------------------

const _chainByHost = new Map<string, number>();

function host(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Resolve a fetch target to an absolute URL against the running app's origin.
 * Same-origin fetches pass a relative path (e.g. '/api/estimate'); capturing it
 * absolute here means the trace panel shows the real sandbox host instead of a
 * placeholder, and host()/chainForUrl() can key off it reliably.
 */
function toAbsoluteUrl(raw: string): string {
  try {
    return new URL(raw, window.location.href).href;
  } catch {
    return raw;
  }
}

function chainForUrl(url: string): number {
  const h = host(url);
  return (h && _chainByHost.get(h)) || 0;
}

function learnChain(url: string, chainId: number): void {
  const h = host(url);
  if (h && chainId > 0) {
    _chainByHost.set(h, chainId);
    log('chain learned:', h, '→', chainId);
  }
}

/** Pre-register a chain's RPC URL so events show the correct chain from the start. */
export function registerChain(chainId: number, rpcUrl: string): void {
  learnChain(rpcUrl, chainId);
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers (single + batch)
// ---------------------------------------------------------------------------

interface JRPCReq { method: string; params?: unknown[]; id?: unknown }
interface JRPCRes { id?: unknown; result?: unknown; error?: { message?: string } }

interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  __studioPatched?: boolean;
}

interface MessageData {
  type?: string;
  enabled?: boolean;
}

interface EIP6963AnnounceProviderEvent extends Event {
  detail?: { provider?: EIP1193Provider };
}

/** Type-safe accessor for window.ethereum (may be set by wallet extensions). */
function getEthereum(): EIP1193Provider | undefined {
  const w = window as unknown as { ethereum?: EIP1193Provider };
  return w.ethereum;
}

function isRpc(b: unknown): b is JRPCReq {
  return typeof b === 'object' && b !== null && !Array.isArray(b)
    && 'method' in b && typeof (b as Record<string, unknown>).method === 'string';
}

function hasRpc(b: unknown): boolean {
  return isRpc(b) || (Array.isArray(b) && b.length > 0 && isRpc(b[0]));
}

function toReqs(b: unknown): JRPCReq[] {
  if (isRpc(b)) {
    return [b];
  }

  if (Array.isArray(b)) {
    return b.filter(isRpc);
  }

  return [];
}

function toResps(b: unknown): JRPCRes[] {
  if (typeof b !== 'object' || b === null) {
    return [];
  }

  return Array.isArray(b) ? (b as JRPCRes[]) : [b];
}

function findResp(resps: JRPCRes[], reqId: unknown): JRPCRes | undefined {
  return resps.find((r) => r.id !== undefined && r.id === reqId);
}

// ---------------------------------------------------------------------------
// Patch globalThis.fetch — captures viem http() transport + regular HTTP
// ---------------------------------------------------------------------------

try {
  const _fetch = globalThis.fetch;
  log('patching fetch');

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const ts = Date.now();
    let method = 'GET';
    let url = '';
    let reqBody: unknown;

    try {
      const rawUrl = input instanceof Request ? input.url : String(input);
      url = toAbsoluteUrl(rawUrl);
      method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      // Noise-match the raw target, not the absolutized URL: the dev preview host
      // (<id>.preview.localhost:5173) contains the "localhost:5173" NOISE substring,
      // so matching the absolute URL would drop every same-origin request in dev.
      if (!_enabled || isNoise(rawUrl)) return _fetch.call(globalThis, input, init);
      if (init?.body) reqBody = tryJson(truncate(typeof init.body === 'string' ? init.body : stringify(init.body)));
    } catch {
      return _fetch.call(globalThis, input, init);
    }

    let res: Response;
    try {
      res = await _fetch.call(globalThis, input, init);
    } catch (err) {
      const dur = Date.now() - ts;
      try {
        if (method === 'POST' && hasRpc(reqBody)) {
          for (const r of toReqs(reqBody)) {
            emitWithGroups({ kind: 'rpc', id: id(), timestamp: ts, method: r.method, params: r.params ?? [], chainId: chainForUrl(url), error: err instanceof Error ? err.message : String(err), duration: dur });
          }
        } else {
          emitWithGroups({ kind: 'http', id: id(), timestamp: ts, method, url, status: 0, duration: dur, requestBody: reqBody });
        }
      } catch { /* swallow */ }
      throw err;
    }

    const dur = Date.now() - ts;
    let resBody: unknown;
    try { resBody = tryJson(truncate(await res.clone().text())); } catch { /* ignore */ }

    try {
      if (method === 'POST' && hasRpc(reqBody)) {
        const reqs = toReqs(reqBody);
        const resps = toResps(resBody);
        for (const r of reqs) {
          const resp = findResp(resps, r.id) ?? resps[0];
          const result = resp?.result;
          const error = resp?.error?.message;
          // Learn chainId from eth_chainId responses
          if (r.method === 'eth_chainId' && result) learnChain(url, parseChainId(result));
          // Also learn from responses that embed chainId (e.g. eth_getTransactionByHash)
          if (result && typeof result === 'object' && 'chainId' in (result as Record<string, unknown>)) {
            const embedded = parseChainId((result as Record<string, unknown>).chainId);
            if (embedded > 0) learnChain(url, embedded);
          }
          emitWithGroups({ kind: 'rpc', id: id(), timestamp: ts, method: r.method, params: r.params ?? [], chainId: chainForUrl(url), result, error, duration: dur });
        }
      } else {
        emitWithGroups({ kind: 'http', id: id(), timestamp: ts, method, url, status: res.status, duration: dur, requestBody: reqBody, responseBody: resBody });
      }
    } catch { /* swallow */ }

    return res;
  };
} catch (e) { log('fetch patch FAILED', e); }

// ---------------------------------------------------------------------------
// Patch window.ethereum.request() — captures EIP-1193 provider calls
// (e.g. eth_sendTransaction, eth_estimateGas via injected wallets)
// ---------------------------------------------------------------------------

let _providerChainId = 0;

function patchProvider(provider: EIP1193Provider | undefined): void {
  if (!provider?.request || provider.__studioPatched) return;
  provider.__studioPatched = true;

  const _request = provider.request.bind(provider);
  log('patching EIP-1193 provider');

  provider.request = async (args: { method: string; params?: unknown[] }): Promise<unknown> => {
    const ts = Date.now();
    if (!_enabled) return _request(args);

    const method = args.method;
    const params = (args.params ?? []);

    let result: unknown;
    try {
      result = await _request(args);
    } catch (err) {
      emitWithGroups({
        kind: 'rpc', id: id(), timestamp: ts,
        method, params, chainId: _providerChainId,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - ts,
      });
      throw err;
    }

    const dur = Date.now() - ts;

    // Learn chainId from eth_chainId responses
    if (method === 'eth_chainId' && result) {
      _providerChainId = parseChainId(result);
      log('provider chain learned:', _providerChainId);
    }

    emitWithGroups({
      kind: 'rpc', id: id(), timestamp: ts,
      method, params, chainId: _providerChainId,
      result, duration: dur,
    });

    return result;
  };

  // Track chain changes
  try {
    provider.on?.('chainChanged', (chainId: unknown) => {
      _providerChainId = parseChainId(chainId);
      log('provider chain changed:', _providerChainId);
    });
  } catch { /* not all providers support .on() */ }
}

try {
  // Case 1: provider already exists
  const existingProvider = getEthereum();
  if (existingProvider) {
    patchProvider(existingProvider);
  }

  // Case 2: provider set later (wallet extensions inject asynchronously)
  let _eth: EIP1193Provider | undefined = existingProvider;
  Object.defineProperty(window, 'ethereum', {
    configurable: true,
    enumerable: true,
    get() { return _eth; },
    set(v: EIP1193Provider | undefined) {
      _eth = v;
      patchProvider(v);
    },
  });

  // Case 3: EIP-6963 multi-provider discovery
  window.addEventListener('eip6963:announceProvider', ((e: EIP6963AnnounceProviderEvent) => {
    patchProvider(e?.detail?.provider);
  }));
} catch (e) { log('EIP-1193 patch FAILED', e); }

log('initialized');
