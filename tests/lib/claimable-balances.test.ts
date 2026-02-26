import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as createRoute } from "@/app/api/routes-d/claimable-balances/create/route";
import { POST as claimRoute } from "@/app/api/routes-d/claimable-balances/claim/route";
import * as claimableBalancesAPI from "@/lib/claimable-balances";

vi.mock("@/lib/claimable-balances", () => {
    return {
        createClaimableBalance: vi.fn(),
        claimBalance: vi.fn(),
    };
});

describe("Claimable Balances Route Handlers", () => {
    const mockSenderRequest = () => {
        return {
            json: vi.fn().mockResolvedValue({
                recipientPublicKey: "GBTEST...",
                amount: "50",
            }),
            headers: new Headers({
                "x-stellar-secret": "SBFES63435GQ64ZKPIGI332O2KIZ2YMXGTG4VRRC6GNXE2WUCMF3GXU7",
            }),
        } as unknown as NextRequest;
    };

    const mockClaimRequest = () => {
        return {
            json: vi.fn().mockResolvedValue({ balanceId: "12345" }),
            headers: new Headers({
                "x-stellar-secret": "SBFES63435GQ64ZKPIGI332O2KIZ2YMXGTG4VRRC6GNXE2WUCMF3GXU7",
            }),
        } as unknown as NextRequest;
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("Test case 1 - Recipient has no trustline: does balance creation succeed?", async () => {
        vi.mocked(claimableBalancesAPI.createClaimableBalance).mockResolvedValue({
            hash: "abc123success",
        } as any);

        const res = await createRoute(mockSenderRequest());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.transactionHash).toBe("abc123success");
    });

    it("Test case 2 - Recipient account does not exist: is a clear, helpful error returned?", async () => {
        vi.mocked(claimableBalancesAPI.createClaimableBalance).mockRejectedValue(
            new Error("Recipient account does not exist on Stellar network. They must create an account first (fund with XLM).")
        );

        const res = await createRoute(mockSenderRequest());
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toContain("Recipient account does not exist on Stellar network");
    });

    it("Test case 3 - Sender has insufficient balance: is the correct error returned?", async () => {
        vi.mocked(claimableBalancesAPI.createClaimableBalance).mockRejectedValue({
            response: {
                data: {
                    extras: {
                        result_codes: {
                            operations: ["op_underfunded"],
                        },
                    },
                },
            },
        });

        const res = await createRoute(mockSenderRequest());
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe("Sender has insufficient balance to create this claimable balance.");
    });

    it("Test case 4 - Claim before trustline: is the expected error returned with an actionable message?", async () => {
        vi.mocked(claimableBalancesAPI.claimBalance).mockRejectedValue({
            response: {
                data: {
                    extras: {
                        result_codes: {
                            operations: ["op_no_trust"],
                        },
                    },
                },
            },
        });

        const res = await claimRoute(mockClaimRequest());
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe("Recipient must add USDC trustline before claiming. Please add a USDC trustline to your account first.");
    });

    it("Test case 5 - Claim after trustline: does the claim succeed correctly?", async () => {
        vi.mocked(claimableBalancesAPI.claimBalance).mockResolvedValue({
            hash: "claim123success",
        } as any);

        const res = await claimRoute(mockClaimRequest());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.transactionHash).toBe("claim123success");
    });
});
