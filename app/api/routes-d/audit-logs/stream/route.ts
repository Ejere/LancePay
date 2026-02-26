import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth";
import { verifySignature, maskSensitiveData } from "@/lib/audit";
import { checkAuditLogAccess } from "@/lib/authorization";
// Prisma types will be inferred or are not needed here explicitly



interface FormattedAuditEvent {
  id: string;
  eventType: string;
  actor:
  | {
    id: string;
    email: string;
    name: string | null;
  }
  | null;
  metadata: Record<string, unknown> | null;
  signature: string;
  isValid: boolean;
  createdAt: string;
}

interface AuditLogResponse {
  success: boolean;
  invoiceId: string;
  events: FormattedAuditEvent[];
  totalEvents: number;
}

/**
 * GET /api/routes-d/audit-logs/stream?invoiceId={id}
 *
 * Retrieves audit logs for an invoice with proper authorization checks.
 * Only the invoice owner and collaborators can access logs.
 * Admins can access all audit logs.
 * Sensitive data is masked for non-owners.
 *
 * @security Requires Bearer token authentication
 * @security Grants access only to invoice owner/collaborators/admins
 * @param request - NextRequest with invoiceId parameter
 * @returns Audit events with proper authorization and masking
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Validate Input
    // ═══════════════════════════════════════════════════════════════

    const invoiceId = request.nextUrl.searchParams.get("invoiceId");
    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required" },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Authenticate User
    // ═══════════════════════════════════════════════════════════════

    const authToken = request.headers
      .get("authorization")
      ?.replace("Bearer ", "");
    if (!authToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const claims = await verifyAuthToken(authToken);
    if (!claims) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { privyId: claims.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Authorize Access
    // ═══════════════════════════════════════════════════════════════

    const accessContext = await checkAuditLogAccess(
      invoiceId,
      user.id,
      user.email
    );

    if (!accessContext.canAccess) {
      // Return 403 for both non-existent and unauthorized access
      // This prevents information leakage about invoice existence
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Fetch and Format Events
    // ═══════════════════════════════════════════════════════════════

    const events = await prisma.auditEvent.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "asc" },
      include: {
        actor: { select: { id: true, email: true, name: true } },
      },
    });

    const formattedEvents: FormattedAuditEvent[] = events.map(
      (event) => {
        const isValid = verifySignature(
          event.invoiceId,
          event.eventType,
          event.createdAt.toISOString(),
          event.metadata as Record<string, unknown> | null,
          event.signature
        );

        // Mask sensitive data for non-owners
        const shouldMaskData = !accessContext.isOwner;

        return {
          id: event.id,
          eventType: event.eventType,
          actor: event.actor
            ? {
              id: event.actor.id,
              email: shouldMaskData
                ? maskEmail(event.actor.email)
                : event.actor.email,
              name: event.actor.name,
            }
            : null,
          metadata: maskSensitiveData(
            event.metadata as Record<string, unknown> | null,
            accessContext.isOwner
          ),
          signature: event.signature,
          isValid,
          createdAt: event.createdAt.toISOString(),
        };
      }
    );

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Return Response
    // ═══════════════════════════════════════════════════════════════

    const response: AuditLogResponse = {
      success: true,
      invoiceId,
      events: formattedEvents,
      totalEvents: events.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Mask an email address to prevent identification
 * @param email - Email to mask
 * @returns Masked email (e.g., u***@example.com)
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.charAt(0)}***@${domain}`;
}
