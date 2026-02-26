export interface AdvanceRepaymentResult {
  processed: boolean
  advanceId?: string
  repaidAmount: number
  remainingAmount: number
}

/**
 * Repays a disbursed advance against a just-paid invoice inside the caller's DB transaction.
 * Throws when invoice proceeds cannot fully cover the repayment amount.
 */
export async function processAdvanceRepayment(
  tx: any,
  invoiceId: string,
  invoiceAmount: number
): Promise<AdvanceRepaymentResult> {
  const advance = await tx.paymentAdvance.findFirst({
    where: {
      invoiceId,
      status: 'disbursed',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!advance) {
    return {
      processed: false,
      repaidAmount: 0,
      remainingAmount: invoiceAmount,
    }
  }

  const totalRepayment = Number(advance.totalRepaymentUSDC)
  const repaidAmount = Math.min(invoiceAmount, totalRepayment)

  if (repaidAmount < totalRepayment) {
    throw new Error(
      `Invoice amount (${invoiceAmount}) is insufficient to repay advance (${totalRepayment})`
    )
  }

  await tx.paymentAdvance.update({
    where: { id: advance.id },
    data: {
      status: 'repaid',
      repaidAt: new Date(),
    },
  })

  await tx.invoice.update({
    where: { id: invoiceId },
    data: { lienActive: false },
  })

  const remainingAmount = Math.max(0, Number((invoiceAmount - repaidAmount).toFixed(2)))

  return {
    processed: true,
    advanceId: advance.id,
    repaidAmount,
    remainingAmount,
  }
}
