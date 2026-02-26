/**
 * @swagger
 * /api/withdrawals:
 *   post:
 *     summary: Initiate a withdrawal
 *     description: Initiates a USDC withdrawal to a registered bank account via Yellow Card. Requires authentication. If 2FA is enabled on the account, a TOTP code must be provided.
 *     tags:
 *       - Withdrawals
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - bankAccountId
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount in USDC to withdraw
 *                 example: 100
 *               bankAccountId:
 *                 type: string
 *                 description: ID of the saved bank account to withdraw to
 *               code:
 *                 type: string
 *                 description: TOTP 2FA code (required if 2FA is enabled)
 *                 example: "123456"
 *     responses:
 *       201:
 *         description: Withdrawal initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Withdrawal initiated
 *                 transactionId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: pending
 *       400:
 *         description: Invalid amount, bank account, or insufficient balance
 *       401:
 *         description: Unauthorized or invalid 2FA code
 *       404:
 *         description: User not found
 *       500:
 *         description: Withdrawal provider error
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuthToken } from '@/lib/auth'
import speakeasy from 'speakeasy'
import { decrypt } from '@/lib/crypto'

import { initiateWithdrawal } from '@/lib/yellowcard'
import { nanoid } from 'nanoid'



export async function POST(request: NextRequest) {
  const authToken = request.headers.get('authorization')?.replace('Bearer ', '')
  const claims = await verifyAuthToken(authToken || '')
  if (!claims) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { privyId: claims.userId },
    include: { wallet: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { amount, bankAccountId, code } = await request.json()

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  //  2FA Check (unchanged)
  if (user.twoFactorEnabled) {
    if (!code) {
      return NextResponse.json({ error: '2FA code required' }, { status: 401 })
    }
    if (user.twoFactorSecret) {
      const secret = decrypt(user.twoFactorSecret)
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: 1,
      })
      if (!verified) {
        return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 })
      }
    }
  }

  //  Validate bank account
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, userId: user.id },
  })
  if (!bankAccount) {
    return NextResponse.json({ error: 'Invalid bank account' }, { status: 400 })
  }

  //  Balance check
  if (!user.wallet) {
    return NextResponse.json({ error: 'Wallet required' }, { status: 400 })
  }
  const { getAccountBalance } = await import('@/lib/stellar');
  const balances = await getAccountBalance(user.wallet.address);
  // Assuming getAccountBalance returns array of balances 
  const usdcBalanceObj = (balances as any[]).find((b: any) => b.asset_code === 'USDC');
  const currentBalance = usdcBalanceObj ? parseFloat(usdcBalanceObj.balance) : 0;

  if (currentBalance < amount) {
    return NextResponse.json(
      { error: 'Insufficient balance' },
      { status: 400 }
    )
  }


  //  Call Yellow Card
  const reference = `wd_${nanoid(10)}`

  let ycResponse
  try {
    ycResponse = await initiateWithdrawal({
      amount,
      reference,
      bankAccount: {
        accountNumber: bankAccount.accountNumber,
        bankCode: bankAccount.bankCode,
        accountName: bankAccount.accountName,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Withdrawal provider error' },
      { status: 500 }
    )
  }

  //  Save as PENDING (NO COMPLETION)
  const transaction = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: 'withdrawal',
      status: 'pending',
      amount,
      currency: 'USDC',
      bankAccountId,
      externalId: ycResponse.transactionId,
      // provider removed
    },
  })

  return NextResponse.json(
    {
      message: 'Withdrawal initiated',
      transactionId: transaction.id,
      status: transaction.status,
    },
    { status: 201 }
  )
}
