Let me read the full eBay section of the agent to see what needs updating. The eBay OAuth flow is already fully wired. The issue is the `redirect_uri` — it's using the raw callback URL but eBay requires it to match exactly the **RuName** you registered, not a plain URL.I'm in Plan mode — I can't edit files directly. Here's the plan for what needs to change, then you can approve it to build:

---

## Implementation Plan: eBay OAuth RuName Fix

### Summary
The eBay OAuth install route uses a plain callback URL as `redirect_uri`, but eBay requires the registered **RuName** (`Oodo_Malachi-OodoMala-JaraWo-kfznigiq`) as the `redirect_uri` value. Also the token exchange callback needs to use the RuName too. Two lines need updating in `server/agent.ts`.

### Files to Modify
1. `server/agent.ts` — replace raw callback URL with RuName in `/ebay/install` route and `/ebay/callback` token exchange

### Changes
**In `/ebay/install`:**
- Replace `redirect_uri = encodeURIComponent(\`${appUrl}/api/ebay/callback\`)` with the RuName: `Oodo_Malachi-OodoMala-JaraWo-kfznigiq`

**In `/ebay/callback` token exchange:**
- Replace `redirect_uri: redirectUri` (the plain URL) with the RuName

**Add to Render env vars:**
- `EBAY_CLIENT_ID=OodoMala-JaraWork-PRD-3c614a5ee-30b58830`
- `EBAY_RU_NAME=Oodo_Malachi-OodoMala-JaraWo-kfznigiq`
- `EBAY_CLIENT_SECRET=<your Cert ID already added>`

### Done When
- [ ] Clicking "Connect eBay" in Marketplace Settings redirects to eBay's consent page
- [ ] After approving, eBay redirects back to `jarawork.onrender.com/?ebay_connected=true`
- [ ] Agent fetches real eBay seller orders on next poll cycle

## Ready to build?

Switch to **Build mode** and I'll apply the two-line fix and push immediately. Plan saved. Switch to **Build mode** using the mode selector and I'll apply the fix and push in one step. Also make sure these three env vars are in Render before testing:

- `EBAY_CLIENT_ID` = `OodoMala-JaraWork-PRD-3c614a5ee-30b58830`
- `EBAY_RU_NAME` = `Oodo_Malachi-OodoMala-JaraWo-kfznigiq`
- `EBAY_CLIENT_SECRET` = your Cert ID
