import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { verifyAuthToken } from '@/lib/auth'
import crypto from 'crypto'
import {
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  rpc,
  Contract,
  Address,
  scValToNative,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk'

const STELLAR_RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org'
const rpcServer = new rpc.Server(STELLAR_RPC_URL)

export async function getAuthContext(request: NextRequest) {
  const authToken = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!authToken) return { error: 'Unauthorized' as const }

  const claims = await verifyAuthToken(authToken)
  if (!claims) return { error: 'Invalid token' as const }

  let user = await prisma.user.findUnique({ where: { privyId: claims.userId } })
  if (!user) {
    const email = (claims as any).email || `${claims.userId}@privy.local`
    user = await prisma.user.create({ data: { privyId: claims.userId, email } })
  }

  const email = ((claims as any).email as string | undefined) || user.email
  return { user, claims, email }
}

/**
 * Escrow contract configuration
 */
const ESCROW_WASM_HASH = process.env.ESCROW_WASM_HASH || '9f580d2b4f435b578391fecce89b7b4de090913763a94f7efb482e3bb8884248'
const FUNDING_SECRET = process.env.STELLAR_FUNDING_WALLET_SECRET || 'SB6PKVQY6JC7NVEHZWTOKFGP4D4ZC7CNBSJMLAN3UAH5RHSHBFFOPP5K'
const USDC_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || 'CAU9AEN3EHVX4K3TBN7X2V6A5X5X5X5X5X5X5X5X5X5X5X5X5XUSDC' // Testnet USDC
const ARBITER_ADDRESS = process.env.ESCROW_ARBITER_ADDRESS || 'GBXC37UXVECFS7BFXA7GAK52YMGMD64BY5PHMBPM6LT5EFB32IJ2HURS'

export async function deployAndInitEscrow(params: {
  clientAddress: string
  freelancerAddress: string
  invoiceId: string
}) {
  if (!FUNDING_SECRET || !ESCROW_WASM_HASH) {
    throw new Error('Server configuration missing for escrow deployment')
  }

  const fundingKp = Keypair.fromSecret(FUNDING_SECRET)
  const sourceAccount = await rpcServer.getAccount(fundingKp.publicKey())

  // 1. Deploy Contract Instance
  // We use createContract with a unique salt per invoice
  const salt = crypto.createHash('sha256').update(params.invoiceId).digest()

  const deployOp = (Operation as any).createContract({
    wasmHash: Buffer.from(ESCROW_WASM_HASH, 'hex'),
    address: Address.fromString(fundingKp.publicKey()),
    salt,
  })

  const deployTx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(deployOp)
    .setTimeout(30)
    .build()

  deployTx.sign(fundingKp)
  const deployResult = await rpcServer.sendTransaction(deployTx)

  if ((deployResult as any).status !== 'PENDING' && (deployResult as any).status !== 'SUCCESS') {
    throw new Error(`Contract deployment failed: ${JSON.stringify(deployResult)}`)
  }

  // Poll for completion to get the contract ID
  let status = (deployResult as any).status
  let txHash = (deployResult as any).hash
  let attempts = 0
  let contractId = ''

  while (status === 'PENDING' && attempts < 10) {
    await new Promise(r => setTimeout(r, 2000))
    const txResponse = await rpcServer.getTransaction(txHash)
    status = (txResponse as any).status
    if (status === 'SUCCESS' && (txResponse as any).returnValue) {
      contractId = Address.fromScAddress((txResponse as any).returnValue.address()).toString()
    }
    attempts++
  }

  if (!contractId) {
    // Fallback: If we can't get it from the tx result, calculate it
    // (This is standard Soroban contract ID derivation)
    // For now we'll throw if polling fails in this demo
    throw new Error('Failed to retrieve contract ID after deployment')
  }

  // 2. Initialize Contract
  const contract = new Contract(contractId)
  const initTxAccount = await rpcServer.getAccount(fundingKp.publicKey())

  const initOp = contract.call(
    'init',
    Address.fromString(params.clientAddress).toScVal(),
    Address.fromString(params.freelancerAddress).toScVal(),
    Address.fromString(ARBITER_ADDRESS).toScVal(),
    Address.fromString(USDC_TOKEN_ADDRESS).toScVal()
  )

  const initTx = new TransactionBuilder(initTxAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(initOp)
    .setTimeout(30)
    .build()

  initTx.sign(fundingKp)
  await rpcServer.sendTransaction(initTx)

  return contractId
}

export async function releaseEscrowFunds(contractId: string) {
  const fundingKp = Keypair.fromSecret(FUNDING_SECRET)
  const sourceAccount = await rpcServer.getAccount(fundingKp.publicKey())
  const contract = new Contract(contractId)

  const releaseOp = contract.call(
    'release_funds',
    Address.fromString(fundingKp.publicKey()).toScVal()
  )

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(releaseOp)
    .setTimeout(30)
    .build()

  tx.sign(fundingKp)
  const result = await rpcServer.sendTransaction(tx)
  return result
}

export const EscrowEnableSchema = z.object({
  invoiceId: z.string().min(1),
  clientAddress: z.string().optional(), // Needed for contract init if not in DB
  releaseConditions: z.string().max(5000).optional(),
})

export const EscrowReleaseSchema = z.object({
  invoiceId: z.string().min(1),
  clientEmail: z.string().email(),
  approvalNotes: z.string().max(5000).optional(),
})

export const EscrowDisputeSchema = z.object({
  invoiceId: z.string().min(1),
  clientEmail: z.string().email(),
  reason: z.string().min(5).max(5000),
  requestedAction: z.enum(['refund', 'revision']),
})
