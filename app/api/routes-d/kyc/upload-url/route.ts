import { randomUUID, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/app/api/routes-d/auto-swap/_shared";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

const DOCUMENT_FIELDS = [
  "photo_id_front",
  "photo_id_back",
  "photo_proof_residence",
  "photo_selfie",
  "photo_additional_1",
  "photo_additional_2",
] as const;

type DocumentField = (typeof DOCUMENT_FIELDS)[number];

function isDocumentField(value: string): value is DocumentField {
  return (DOCUMENT_FIELDS as readonly string[]).includes(value);
}

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function createCloudinarySignature(
  params: Record<string, string | number>,
  apiSecret: string
): string {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1")
    .update(`${payload}${apiSecret}`)
    .digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    let body: {
      field?: unknown;
      fileName?: unknown;
      fileType?: unknown;
      fileSize?: unknown;
    };
    try {
      body = (await req.json()) as {
        field?: unknown;
        fileName?: unknown;
        fileType?: unknown;
        fileSize?: unknown;
      };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const field =
      typeof body.field === "string" && isDocumentField(body.field)
        ? body.field
        : null;
    if (!field) {
      return NextResponse.json(
        { error: "Invalid document field requested" },
        { status: 400 }
      );
    }

    const fileName =
      typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileType =
      typeof body.fileType === "string" ? body.fileType.trim() : "";
    const fileSize =
      typeof body.fileSize === "number" && Number.isFinite(body.fileSize)
        ? body.fileSize
        : NaN;

    if (!fileName) {
      return NextResponse.json(
        { error: "fileName is required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      return NextResponse.json(
        {
          error: "Only JPEG, PNG, and PDF documents are accepted",
          allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { error: "Invalid file size provided" },
        { status: 400 }
      );
    }

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 25MB size limit" },
        { status: 400 }
      );
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary environment variables are not configured" },
        { status: 500 }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `kyc_docs/${auth.user.id}`;
    const basename = sanitizeSegment(fileName.replace(/\.[^/.]+$/, "")) || "doc";
    const publicId = `${field}_${basename}_${randomUUID().slice(0, 8)}`;

    const paramsToSign: Record<string, string | number> = {
      folder,
      public_id: publicId,
      timestamp,
    };

    if (fileType.startsWith("image/")) {
      paramsToSign.transformation = "q_auto:good";
    }

    const signature = createCloudinarySignature(paramsToSign, apiSecret);

    return NextResponse.json({
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      uploadParams: {
        ...paramsToSign,
        api_key: apiKey,
        signature,
      },
      constraints: {
        maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
        allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
      },
    });
  } catch (error: any) {
    console.error("Error creating Cloudinary upload signature:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
