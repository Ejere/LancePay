import { NextRequest, NextResponse } from "next/server";
import { claimBalance } from "@/lib/claimable-balances";
import { Keypair } from "@stellar/stellar-sdk";

export async function POST(req: NextRequest) {
    try {
        const { balanceId } = await req.json();

        if (!balanceId) {
            return NextResponse.json(
                { error: "Balance ID required" },
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

        const keypair = Keypair.fromSecret(secretKey);
        const result = await claimBalance(keypair, balanceId);

        return NextResponse.json({
            success: true,
            transactionHash: result.hash,
        });
    } catch (error: unknown) {
        console.error("Error claiming balance:", error);

        const err = error as {
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

        let errorMessage = "Failed to claim balance";

        if (err?.response?.data?.extras?.result_codes?.operations) {
            const opCodes = err.response.data.extras.result_codes.operations;
            if (opCodes.includes("op_no_trust")) {
                errorMessage = "Recipient must add USDC trustline before claiming. Please add a USDC trustline to your account first.";
            } else if (opCodes.includes("op_no_destination")) {
                errorMessage = "Recipient account does not exist.";
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
