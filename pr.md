Fixes a critical bug where `op_no_trust` is incorrectly thrown when a recipient lacks a USDC trustline during claimable balance creation.

### What we did
1. **Removed `hasUSDCTrustline` check** from `createClaimableBalance`.
2. **Added `accountExists` check** before building the transaction to ensure the recipient account exists on the Stellar network, otherwise throwing a clear instructional error.
3. **Updated the create route** to elegantly translate raw Stellar SDK errors into human-readable messages (op_underfunded, op_low_reserve, etc).
4. **Handled `op_no_trust`** in the `/claim` route to instruct users when they try to claim *before* adding the trustline: *"Recipient must add USDC trustline before claiming. Please add a USDC trustline to your account first."*
5. **Added a UI hint** to the payment page explicitly telling the recipient about the 2-step flow.
6. **Added an Auto-claim component** tracking available claimable balances via the dashbord and giving users 1-click access.
7. **Added tests** via Vitest covering all five requested regression scenarios correctly.
8. **Added architecture docs** in `docs/CLAIMABLE_BALANCES.md` about the two-step flow.

Closes #241
