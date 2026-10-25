Good choice. Here's the step-by-step setup in Circle Console before I write any code.

---

**Step 1 — Get your Client Key**

1. Go to https://console.circle.com
2. Click **Wallets** in the left sidebar
3. Click **Modular Wallets**
4. Click **Client Keys**
5. Click **Create Client Key**
6. Name it `JaraWork Production`
7. Copy the key — it starts with `LIVE_CLIENT_KEY:` for mainnet

Come back with the key and I'll add it to `.env`.

---

**Step 2 — Set your Passkey Domain**

Still in Console → Modular Wallets:

1. Click **Passkey Domains**
2. Click **Add Domain**
3. Enter exactly: `jarawork.onrender.com`
4. Save

This binds passkeys to your production domain. Users on `jarawork.onrender.com` will be able to create and use their passkey wallet.

---

**Step 3 — Set up Gas Station for the first transaction only**

1. In Console, click **Gas Station**
2. Click **Create Policy**
3. Set:
   - **Name:** `JaraWork First Transaction`
   - **Chain:** Arc Mainnet
   - **Max gas per user operation:** `0.01 USDC`
   - **Max operations per wallet:** `1` — this limits sponsorship to one transaction per wallet, which covers the first claim/registration only
4. Deposit a small amount of USDC into the policy — start with 5 USDC, top up as users grow
5. Copy the **Policy ID**

Come back with your Client Key and Policy ID and I'll build the full integration.
