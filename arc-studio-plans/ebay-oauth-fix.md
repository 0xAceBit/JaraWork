# eBay OAuth RuName Fix

## Summary
Wire the registered RuName into the eBay OAuth flow in `server/agent.ts` so the consent redirect and token exchange both use the correct identifier.

## Files to Modify
1. `server/agent.ts` — replace raw callback URL with RuName in `/ebay/install` and `/ebay/callback`

## Changes

### `/ebay/install` route
Replace:
```
const redirectUri = encodeURIComponent(`${appUrl}/api/ebay/callback`)
```
With:
```
const ruName = process.env.EBAY_RU_NAME ?? 'Oodo_Malachi-OodoMala-JaraWo-kfznigiq'
```
And update the authUrl to use `encodeURIComponent(ruName)` as `redirect_uri`.

### `/ebay/callback` token exchange
Replace `redirect_uri: redirectUri` (plain URL) with `redirect_uri: ruName` (the RuName).

## Render Env Vars to Add
- `EBAY_CLIENT_ID=OodoMala-JaraWork-PRD-3c614a5ee-30b58830`
- `EBAY_RU_NAME=Oodo_Malachi-OodoMala-JaraWo-kfznigiq`
- `EBAY_CLIENT_SECRET=<Cert ID already added>`

## Done When
- [ ] Connect eBay button redirects to eBay consent page
- [ ] After approval, redirects back to `/?ebay_connected=true`
- [ ] Agent fetches real eBay seller orders on next poll
