# Claimable Balances Architecture

## Two-Step Claim Flow

Stellar Claimable Balances are designed to decouple payment from the recipient's trustline requirement, removing friction from onboarding.

### The Problem with Single-Step Methods
A common anti-pattern is checking if a user has a USDC trustline *before* creating the claimable balance, and failing the transaction with `op_no_trust` if they do not. This defeats the purpose of claimable balances, because it forces the recipient to have the trustline funded with XLM and established *before* they can even be paid.

### The Correct Two-Step Flow

LancePay implements the Correct Two-Step Claimable Balance Flow:

#### Step 1: Creation (Sender)
1. **Account Existence Check**: We first verify if the specified recipient's `publicKey` exists on the Stellar network.
2. **Missing Account Scenario**: If the account does not exist (HTTP 404 from Horizon), we inform the sender that the recipient must create and fund an account with XLM.
3. **Creation without Trustline**: We explicitly do **NOT** check for a USDC trustline. We use `Claimant.predicateUnconditional()` to build the claimable balance, which succeeds even if the recipient lacks the trustline.
4. **Notifications**: We trigger internal notifications alerting the recipient.

#### Step 2: Claiming (Recipient)
1. **Auto-Claim Request**: When the recipient navigates to their dashboard, LancePay detects any outstanding balances.
2. **Trustline Check upon Claiming**: The user attempts to claim the balance via the `/api/routes-d/claimable-balances/claim` route.
3. **No Trustline Error (`op_no_trust`)**: If they attempt this *without* having added a USDC trustline, the SDK returns an `op_no_trust` error.
4. **Human-Readable Action Required**: Our `/claim` route intercepts the `op_no_trust` code and instructs the recipient: *"Recipient must add USDC trustline before claiming. Please add a USDC trustline to your account first."* 
5. **Success**: Once they add the trustline, the claim succeeds, transferring the reserved USDC into their wallet balance.

*This two-step flow guarantees that senders are not randomly blocked by the recipient's wallet state, whilst safely and predictably guiding the recipient through any missing requirements on their side.*
