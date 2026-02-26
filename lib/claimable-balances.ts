import {
  Operation,
  Claimant,
  Keypair,
  TransactionBuilder,
  BASE_FEE
} from "@stellar/stellar-sdk";
import { server, USDC_ASSET, STELLAR_NETWORK } from "./stellar";

export async function accountExists(publicKey: string): Promise<boolean> {
  try {
    await server.loadAccount(publicKey);
    return true;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const resp = error.response as { status: number };
      if (resp.status === 404) {
        return false;
      }
    }
    throw error;
  }
}

/**
 * Create a claimable balance for a recipient without trustline
 */
export async function createClaimableBalance(
  senderKeypair: Keypair,
  recipientPublicKey: string,
  amount: string
) {
  const recipientExists = await accountExists(recipientPublicKey);

  if (!recipientExists) {
    throw new Error(
      "Recipient account does not exist on Stellar network. " +
      "They must create an account first (fund with XLM)."
    );
  }

  const senderAccount = await server.loadAccount(senderKeypair.publicKey());

  const claimant = new Claimant(
    recipientPublicKey,
    Claimant.predicateUnconditional()
  );

  const transaction = new TransactionBuilder(senderAccount, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK,
  })
    .addOperation(
      Operation.createClaimableBalance({
        asset: USDC_ASSET,
        amount: amount,
        claimants: [claimant],
      })
    )
    .setTimeout(180)
    .build();

  transaction.sign(senderKeypair);
  return await server.submitTransaction(transaction);
}

/**
 * Fetch claimable balances for a user
 */
export async function getClaimableBalances(publicKey: string) {
  const response = await server
    .claimableBalances()
    .claimant(publicKey)
    .call();

  return response.records.filter(
    (cb: { asset: string }) =>
      cb.asset.split(":")[0] === USDC_ASSET.code &&
      cb.asset.split(":")[1] === USDC_ASSET.issuer
  );
}

/**
 * Claim a claimable balance
 */
export async function claimBalance(
  recipientKeypair: Keypair,
  balanceId: string
) {
  const account = await server.loadAccount(recipientKeypair.publicKey());

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK,
  })
    .addOperation(
      Operation.claimClaimableBalance({
        balanceId: balanceId,
      })
    )
    .setTimeout(180)
    .build();

  transaction.sign(recipientKeypair);
  return await server.submitTransaction(transaction);
}

/**
 * Get total claimable USDC amount for a user
 */
export async function getTotalClaimableAmount(publicKey: string): Promise<string> {
  const balances = await getClaimableBalances(publicKey);
  const total = balances.reduce((sum: number, cb: { amount: string }) => {
    return sum + parseFloat(cb.amount);
  }, 0);
  return total.toFixed(7);
}
