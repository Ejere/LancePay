import { NextRequest, NextResponse } from "next/server";
import { createClaimableBalance } from "@/lib/claimable-balances";
import { Keypair } from "@stellar/stellar-sdk";

export async function POST(req: NextRequest) {
    try {
        const { recipientPublicKey, amount } = await req.json();

        if (!recipientPublicKey || !amount) {
            return NextResponse.json(
                { error: "Recipient and amount required" },
                { status: 400 }
            );
        }

        const secretKey = req.headers.get("x-stellar-secret");
        if (!secretKey) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const senderKeypair = Keypair.fromSecret(secretKey);
        const result = await createClaimableBalance(senderKeypair, recipientPublicKey, amount.toString());

        // Trigger notification
        try {
            // Assuming there's a notification service, but if none we can just log
            console.log(`Notification: Claimable balance created for ${recipientPublicKey}`);
        } catch {
            // Ignore notification failures
        }

        return NextResponse.json({
            success: true,
            transactionHash: result.hash,
        });
    } catch (error: unknown) {
        console.error("Error creating claimable balance:", error);

        const err = error as {
            message?: string;
            response?: {
                data?: {
                    extras?: {
                        result_codes?: {
                            operations?: string[];
                            transaction?: string
                        }
                    }
                }
            }
        };

        let errorMessage = "Failed to create claimable balance";

        if (err.message && err.message.includes("Recipient account does not exist")) {
            errorMessage = err.message;
        } else if (err?.response?.data?.extras?.result_codes?.operations) {
            const opCodes = err.response.data.extras.result_codes.operations;
            if (opCodes.includes("op_underfunded")) {
                errorMessage = "Sender has insufficient balance to create this claimable balance.";
            } else if (opCodes.includes("op_low_reserve")) {
                errorMessage = "Sender account does not have enough XLM to meet minimum reserve requirements.";
            } else {
                errorMessage = `Operation failed: ${opCodes.join(', ')}`;
            }
        } else if (err?.response?.data?.extras?.result_codes?.transaction === "tx_failed") {
            errorMessage = "Transaction failed on the Stellar network.";
        }

        return NextResponse.json(
            { error: errorMessage },
            { status: 400 }
        );
    }
}
