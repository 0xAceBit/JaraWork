# Implementation Plan: Legal Pages + Ace Corporation Attribution

## Summary
Add a footer with Ace Corporation operator attribution, Terms of Service, and Privacy Policy to JaraWork. No contract, agent, or escrow logic is touched.

## Files to Create
1. `src/components/Footer.tsx` — footer with Ace Corporation name, copyright, Terms and Privacy links that open a modal
2. `src/components/TermsOfService.tsx` — full Terms of Service content governed by Nigerian law
3. `src/components/PrivacyPolicy.tsx` — full Privacy Policy content for a payments platform

## Files to Modify
1. `src/App.tsx` — import Footer and render it above the bottom nav bar

## Key Details
- Operator: Ace Corporation
- Jurisdiction: Nigeria
- Contact email: legal@acecorporation.ng (placeholder — user to update)
- No changes to any contract address, agent logic, hooks, or escrow flow
- Legal pages open in a modal overlay (no routing changes needed)

## Done When
- [ ] Footer visible on every tab showing "Operated by Ace Corporation"
- [ ] Terms of Service accessible via footer link
- [ ] Privacy Policy accessible via footer link
- [ ] Zero TypeScript errors
- [ ] Pushed to GitHub
