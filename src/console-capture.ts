/**
 * Console & Error Capture Instrumentation
 *
 * Patches console.{log,info,warn,error,debug} and listens for window 'error'
 * and 'unhandledrejection' events, forwarding each to the parent frame via
 * postMessage ({ type: 'studio-console-log' }). The parent persists these to
 * `console.jsonl` inside the sandbox so the Arc Studio agent can read runtime
 * output when diagnosing a broken preview.
 *
 * Self-throttling: consecutive duplicate lines are collapsed and a per-second
 * rate limit caps the postMessage volume so a render-loop log storm cannot
 * flood the parent.
 *
 * Imported as a side-effect before any app code runs. The original console
 * behaviour is always preserved.
 * Built with Arc Studio — https://studio.arc.io
 */

type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface ConsoleLogEntry {
  level: ConsoleLevel;
  message: string;
  timestamp: number;
  source?: string;
  stack?: string;
}

const MESSAGE_TYPE = 'studio-console-log';
const MAX_MESSAGE_CHARS = 4_000;
const MAX_STACK_CHARS = 4_000;
const RATE_LIMIT_WINDOW_MS = 1_000;
const MAX_PER_WINDOW = 100;
const MAX_REPEAT_BEFORE_FLUSH = 500;

// Lines emitted by our own tracing instrumentation are noise for the agent.
const NOISE_PREFIXES = ['[studio-trace]'];

const LEVELS: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

// ---------------------------------------------------------------------------
// Parent origin resolution (mirrors tracing.ts)
// ---------------------------------------------------------------------------

const _parentOrigin: string = (() => {
  try {
    if (window.location.ancestorOrigins?.length) {
      return window.location.ancestorOrigins[0];
    }
  } catch {
    /* sandboxed iframe may throw */
  }

  try {
    if (document.referrer) {
      return new URL(document.referrer).origin;
    }
  } catch {
    /* malformed referrer */
  }

  return '*';
})();

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    const json = JSON.stringify(value, (_key: string, val: unknown): unknown => {
      if (typeof val === 'bigint') {
        return `${val.toString()}n`;
      }

      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return '[Circular]';
        }

        seen.add(val);
      }

      return val;
    });

    return json ?? String(value);
  } catch {
    return String(value);
  }
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') {
    return arg;
  }

  if (arg instanceof Error) {
    return arg.stack ?? `${arg.name}: ${arg.message}`;
  }

  if (arg === undefined) {
    return 'undefined';
  }

  return safeStringify(arg);
}

function truncate(s: string, maxChars: number = MAX_MESSAGE_CHARS): string {
  return s.length > maxChars ? `${s.slice(0, maxChars)}… [truncated]` : s;
}

function truncateStack(stack: string | undefined): string | undefined {
  return stack ? truncate(stack, MAX_STACK_CHARS) : undefined;
}

function firstErrorStack(args: unknown[]): string | undefined {
  for (const arg of args) {
    if (arg instanceof Error && arg.stack) {
      return truncateStack(arg.stack);
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

let _windowStart = Date.now();
let _windowCount = 0;
let _dropped = 0;

function send(entry: ConsoleLogEntry): void {
  try {
    window.parent.postMessage({ type: MESSAGE_TYPE, entry }, _parentOrigin);
  } catch {
    /* ignore — postMessage can throw on cross-origin edge cases */
  }
}

function post(entry: ConsoleLogEntry): void {
  const now = Date.now();

  if (now - _windowStart >= RATE_LIMIT_WINDOW_MS) {
    if (_dropped > 0) {
      const dropped = _dropped;
      _dropped = 0;
      send({ level: 'warn', message: `[studio-console] rate limit: dropped ${dropped} message(s)`, timestamp: now });
    }

    _windowStart = now;
    _windowCount = 0;
  }

  if (_windowCount >= MAX_PER_WINDOW) {
    _dropped++;
    return;
  }

  _windowCount++;
  send(entry);
}

// ---------------------------------------------------------------------------
// Consecutive-duplicate collapsing
// ---------------------------------------------------------------------------

let _lastKey = '';
let _lastLevel: ConsoleLevel = 'log';
let _repeat = 0;

function flushRepeat(): void {
  if (_repeat > 0) {
    const repeat = _repeat;
    _repeat = 0;
    post({ level: _lastLevel, message: `(previous line repeated ${repeat}× more)`, timestamp: Date.now() });
  }
}

function emit(entry: ConsoleLogEntry): void {
  const key = `${entry.level}\u0000${entry.message}`;

  if (key === _lastKey) {
    _repeat++;

    if (_repeat >= MAX_REPEAT_BEFORE_FLUSH) {
      flushRepeat();
    }

    return;
  }

  flushRepeat();
  _lastKey = key;
  _lastLevel = entry.level;
  post(entry);
}

function isNoise(message: string): boolean {
  return NOISE_PREFIXES.some((p) => message.startsWith(p));
}

// ---------------------------------------------------------------------------
// console.* patching
// ---------------------------------------------------------------------------

for (const level of LEVELS) {
  const original = console[level].bind(console);

  console[level] = (...args: unknown[]): void => {
    original(...args);

    try {
      const message = truncate(args.map(formatArg).join(' '));

      if (message && !isNoise(message)) {
        emit({ level, message, timestamp: Date.now(), stack: firstErrorStack(args) });
      }
    } catch {
      /* never let capture break the app's logging */
    }
  };
}

// ---------------------------------------------------------------------------
// Uncaught errors & unhandled rejections — the signals a blank preview hides
// ---------------------------------------------------------------------------

window.addEventListener('error', (e: ErrorEvent) => {
  try {
    flushRepeat();
    const source = e.filename ? `${e.filename}:${e.lineno ?? 0}:${e.colno ?? 0}` : undefined;
    post({
      level: 'error',
      message: truncate(e.message || 'Uncaught error'),
      timestamp: Date.now(),
      source,
      stack: e.error instanceof Error ? truncateStack(e.error.stack) : undefined,
    });
  } catch {
    /* ignore */
  }
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  try {
    flushRepeat();
    const reason: unknown = e.reason;
    post({
      level: 'error',
      message: truncate(`Unhandled promise rejection: ${formatArg(reason)}`),
      timestamp: Date.now(),
      stack: reason instanceof Error ? truncateStack(reason.stack) : undefined,
    });
  } catch {
    /* ignore */
  }
});
