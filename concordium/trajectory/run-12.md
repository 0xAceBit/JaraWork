# Run 12: claim-audited README, 3-minute demo, architecture, path to production

Date: 2026-11-17. Branch: concordium-hackathon. The live JaraWork app and main were not touched.

## Did
- Rewrote README.md from an inventory of the code: the settings list is generated from what the code reads, not from memory. It found settings the old README listed but the code never read, and ones the code read that the README missed.
- Every table row points at a file, a test or a recorded log. Claims with no code behind them were removed (for example "stablecoins", "identity proofs" and "mainnet" appear only under "Not used").
- Rewrote docs/demo-video-script.md as a 3-minute script. Every command in it was run first, and the expected output is the real output.
- Rewrote docs/architecture.md with three Mermaid diagrams. All three parse with Mermaid 12.3.0's real parser; they have not been seen rendered.
- Added trajectory/evidence.json and scripts/verify-evidence.ts: asks the chain about the six transactions the docs cite (registration, latest re-pin, four payments) and compares type, sender, recipient, amount and fee payer. All six match.
- Added test/docs.test.ts: fails if the README or the two docs name a file, route, tool, setting or default the code does not back, if a hash is not in the evidence, or if the style rules are broken.

## Verified
- The docs test passes, and it fails when fed four deliberate false claims (a missing file, an unread setting, an unknown route, a wrong default); the README was restored identical.
- An unconfigured server starts closed (503 on /mcp), and X402_MODE=free starts and serves, exactly as the README says.

## Found while doing it
- CCD_NETWORK is only a label in the service; it does not switch networks. Documented as such.
- My first settings check missed PORT (no underscore) and CCD_PAYEE_PRIVATE_KEY (name chosen at run time). Both were gaps in the test, not false claims; the test was widened and rerun.

## Not done
- The Mermaid diagrams are not seen rendered; check them on GitHub.
- The video is not recorded.
