/*
 * Circle transaction states and the poller for them. GENERATED — do not edit.
 *
 * Arc Studio writes this file from its own source. Edits are overwritten.
 *
 *   import { waitForSuccessfulTransaction, isTerminalTransactionState } from '@/onchain-wait';
 *
 * This module owns the terminal-state list, which is exactly:
 *
 *   COMPLETE, FAILED, DENIED, CANCELLED
 *
 * Never restate it. 'CONFIRMED' means included in a block and NOT final, so
 * treating it as success tells the user a deposit landed before Circle settled.
 */

/*
 * Single owner of the Circle transaction state machine and of the poll loop
 * that waits on it.
 *
 * This source ships verbatim into every sandbox as `@/onchain-wait`. It has no
 * imports, so keep it that way.
 *
 * `CONFIRMED` means included in a block, not final, so it is NOT terminal.
 * Treating it as success reports a deposit as done before Circle has settled it.
 */

export const TERMINAL_TRANSACTION_STATES = ['COMPLETE', 'FAILED', 'DENIED', 'CANCELLED'] as const;

export const INTERMEDIATE_TRANSACTION_STATES = [
  'INITIATED',
  'WAITING',
  'QUEUED',
  'CLEARED',
  'SENT',
  'STUCK',
  'CONFIRMED',
] as const;

export const SUCCESSFUL_TRANSACTION_STATE = 'COMPLETE';

export type TerminalTransactionState = (typeof TERMINAL_TRANSACTION_STATES)[number];

export type IntermediateTransactionState = (typeof INTERMEDIATE_TRANSACTION_STATES)[number];

export type TransactionState = TerminalTransactionState | IntermediateTransactionState;

export const DEFAULT_POLL_INTERVAL_MS = 2_000;

export const DEFAULT_POLL_TIMEOUT_MS = 180_000;

const TERMINAL_SET: ReadonlySet<string> = new Set(TERMINAL_TRANSACTION_STATES);

const INTERMEDIATE_SET: ReadonlySet<string> = new Set(INTERMEDIATE_TRANSACTION_STATES);

export function isTerminalTransactionState(state: string | undefined | null): state is TerminalTransactionState {
  return typeof state === 'string' && TERMINAL_SET.has(state);
}

export function isKnownTransactionState(state: string | undefined | null): state is TransactionState {
  return isTerminalTransactionState(state) || (typeof state === 'string' && INTERMEDIATE_SET.has(state));
}

export function isSuccessfulTransactionState(state: string | undefined | null): boolean {
  return state === SUCCESSFUL_TRANSACTION_STATE;
}

export class TransactionTimeoutError extends Error {
  readonly lastState: string | undefined;
  readonly timeoutMs: number;

  constructor(lastState: string | undefined, timeoutMs: number) {
    super(
      `Transaction did not reach a terminal state within ${Math.round(timeoutMs / 1000)}s ` +
        `(last state: ${lastState ?? 'unknown'}). Terminal states are ${TERMINAL_TRANSACTION_STATES.join(', ')}.`,
    );
    this.name = 'TransactionTimeoutError';
    this.lastState = lastState;
    this.timeoutMs = timeoutMs;
  }
}

export class TransactionFailedError extends Error {
  readonly state: TerminalTransactionState;

  constructor(state: TerminalTransactionState, label?: string) {
    super(`${label ?? 'Transaction'} reached terminal state ${state} instead of ${SUCCESSFUL_TRANSACTION_STATE}`);
    this.name = 'TransactionFailedError';
    this.state = state;
  }
}

export interface WaitForTerminalOptions {
  intervalMs?: number;
  timeoutMs?: number;
  /** Called after each poll, before the next sleep. */
  onState?: (state: string | undefined, attempt: number) => void;
  /** Test seams. Production callers leave both unset. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pollUntilTerminal<T>(
  poll: () => Promise<T>,
  readState: (value: T) => string | undefined,
  options: WaitForTerminalOptions,
): Promise<{ value: T; state: TerminalTransactionState }> {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(`Poll interval must be a positive number of milliseconds, got ${intervalMs}`);
  }

  const startedAt = now();
  let attempt = 0;
  let lastState: string | undefined;

  for (;;) {
    const value = await poll();
    lastState = readState(value);
    attempt += 1;
    options.onState?.(lastState, attempt);

    if (isTerminalTransactionState(lastState)) {
      return { value, state: lastState };
    }

    if (now() - startedAt >= timeoutMs) {
      throw new TransactionTimeoutError(lastState, timeoutMs);
    }

    await sleep(intervalMs);
  }
}

/**
 * Polls until the record reaches a terminal state, then returns that record.
 *
 * A terminal state means Circle is done with the transaction; it does not mean
 * the transaction succeeded. Use `waitForSuccessfulTransaction` when only
 * `COMPLETE` will do.
 */
export async function waitForTerminal<T>(
  poll: () => Promise<T>,
  readState: (value: T) => string | undefined,
  options: WaitForTerminalOptions = {},
): Promise<T> {
  return (await pollUntilTerminal(poll, readState, options)).value;
}

/** `waitForTerminal` for a poll that already yields the state string. */
export async function waitForTerminalState(
  poll: () => Promise<string | undefined>,
  options: WaitForTerminalOptions = {},
): Promise<TerminalTransactionState> {
  return (await pollUntilTerminal(poll, (value) => value, options)).state;
}

export function assertTransactionSucceeded(state: TerminalTransactionState, label?: string): void {
  if (!isSuccessfulTransactionState(state)) {
    throw new TransactionFailedError(state, label);
  }
}

/** Waits for a terminal state and throws unless it is `COMPLETE`. */
export async function waitForSuccessfulTransaction<T>(
  poll: () => Promise<T>,
  readState: (value: T) => string | undefined,
  options: WaitForTerminalOptions & { label?: string } = {},
): Promise<T> {
  const { value, state } = await pollUntilTerminal(poll, readState, options);

  assertTransactionSucceeded(state, options.label);

  return value;
}
