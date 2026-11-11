# Submission checklist

## Links and evidence to include
- Repo: https://github.com/0xAceBit/JaraWork/tree/concordium-hackathon/concordium (branch `concordium-hackathon`)
- Live service: https://jarawork-agent.onrender.com
- Concordium's own verification: https://agent-registry-mcp.concordium.com/v1/badge-check/JyP9YR6Wk3YPaGx3e8zyu (returns `badge_valid: true`)
- Agent: registry token 1008, token address `JyP9YR6Wk3YPaGx3e8zyu`, CIS-8004 registry contract 12802,0 on testnet, owner `47rTdQXdTQkWiL4fbHqdkxdtdpmWVGRTy7kXxXgxNJuirVV3pk`
- Transactions (search the hash on https://testnet.ccdscan.io): registration `2b829c80ed1a1bce963fd31772671f62f7adb362f6759ea7aec5376f3486c336`, latest card pin `73ab7ad41abd885417bb4ff076862a518cef15c3e44ae1a1136831ea4d8912f9`
- Paid verdicts from the recorded live run: see `trajectory/judge-demo-2026-11-11-run2.txt` (four payment hashes and the fee split)
- Run logs: `trajectory/` (one file per working session) and `trajectory/x402/` (end-to-end test logs)
- Honest self-review: `docs/09-judge-review.md`; integration notes: `docs/integration-map.md`; diagrams: `docs/architecture.md`

## Questions to ask the organizers (I do not know the answers)
1. Does a project that existed before the event qualify, and how should pre-existing work be shown?
2. What exactly is expected at the 22 November checkpoint?
3. Submission format: video length, form fields, required licence, public repo only?
4. Is testnet-only acceptable, and is a simulated carrier lookup acceptable if labelled?
5. Beyond integration depth and a credible path to production, what else is scored?

## Before you submit (your actions)
- [ ] Decide the keep-alive: a sleeping free service fails the registry's card check until it wakes.
- [ ] Confirm on Render: `X402_ALLOW_EPHEMERAL_LEDGER=true` and the sponsor key are set, and `X402_MODE` is not `free`.
- [ ] Open https://jarawork-agent.onrender.com/x402/status and check it shows `"mode":"paid"`.
- [ ] Record the video from `docs/demo-video-script.md`.
- [ ] View `docs/architecture.md` on GitHub and check both diagrams render.
- [ ] Add a licence file if the rules require one.
- [ ] Run the secret check below and confirm it prints zeros.

## Secret check
Run on 2026-11-11 over the whole git history (every branch): the owner, payer and sponsor private keys each appear 0 times, and no `.env` file is tracked (`concordium/.env` is git-ignored). Repeat it before submitting:
```
for NAME in CCD_OWNER_PRIVATE_KEY CCD_PAYER_PRIVATE_KEY CCD_SPONSOR_PRIVATE_KEY; do
  VAL=$(grep "^$NAME=" concordium/.env | cut -d= -f2-); git log --all -p -S"$VAL" --oneline | wc -l
done
```
Each line should print 0.
