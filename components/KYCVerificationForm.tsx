"use client";

import { useMemo, useState } from "react";
import { KYCStatus, getStatusMessage } from "@/lib/sep12-kyc";

interface KYCVerificationFormProps {
  currentStatus?: KYCStatus;
  onSubmit: (formData: FormData) => Promise<void>;
  requestHeaders?: Record<string, string>;
}

const MAX_FILE_COUNT = 6;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
const ALLOWED_MIME_TYPE_SET = new Set<string>(ALLOWED_MIME_TYPES);
const ACCEPT_ATTRIBUTE = ALLOWED_MIME_TYPES.join(",");

const DOCUMENT_CONFIG = [
  {
    field: "photo_id_front",
    label: "ID Front Photo",
    required: true,
  },
  {
    field: "photo_id_back",
    label: "ID Back Photo (if applicable)",
    required: false,
  },
  {
    field: "photo_proof_residence",
    label: "Proof of Residence",
    required: true,
  },
  {
    field: "photo_selfie",
    label: "Selfie (optional)",
    required: false,
  },
  {
    field: "photo_additional_1",
    label: "Additional Supporting Document 1 (optional)",
    required: false,
  },
  {
    field: "photo_additional_2",
    label: "Additional Supporting Document 2 (optional)",
    required: false,
  },
] as const;

type DocumentField = (typeof DOCUMENT_CONFIG)[number]["field"];

type CloudinarySignatureResponse = {
  uploadUrl: string;
  uploadParams: Record<string, string | number>;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  error?: {
    message?: string;
  };
};

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

export function KYCVerificationForm({
  currentStatus,
  onSubmit,
  requestHeaders,
}: KYCVerificationFormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<
    Partial<Record<DocumentField, number>>
  >({});

  const statusInfo = currentStatus ? getStatusMessage(currentStatus) : null;
  const uploadProgressRows = useMemo(
    () =>
      DOCUMENT_CONFIG.filter(
        ({ field }) => typeof uploadProgress[field] === "number"
      ),
    [uploadProgress]
  );

  const uploadDocument = async (
    field: DocumentField,
    file: File
  ): Promise<string> => {
    const signedUploadResponse = await fetch("/api/routes-d/kyc/upload-url", {
      method: "POST",
      headers: {
        ...requestHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        field,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
    });

    if (!signedUploadResponse.ok) {
      const payload = (await signedUploadResponse
        .json()
        .catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || "Failed to prepare document upload");
    }

    const signedPayload =
      (await signedUploadResponse.json()) as CloudinarySignatureResponse;
    if (!signedPayload.uploadUrl || !signedPayload.uploadParams) {
      throw new Error("Upload URL response was invalid");
    }

    const uploadBody = new FormData();
    for (const [key, value] of Object.entries(signedPayload.uploadParams)) {
      uploadBody.append(key, String(value));
    }
    uploadBody.append("file", file);

    setUploadProgress((current) => ({ ...current, [field]: 0 }));

    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", signedPayload.uploadUrl);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.min(
          100,
          Math.round((event.loaded / event.total) * 100)
        );
        setUploadProgress((current) => ({ ...current, [field]: percent }));
      };

      xhr.onload = () => {
        let payload: CloudinaryUploadResponse = {};
        try {
          payload = JSON.parse(xhr.responseText) as CloudinaryUploadResponse;
        } catch {
          // Ignore parse failures and use generic error below
        }

        if (
          xhr.status >= 200 &&
          xhr.status < 300 &&
          typeof payload.secure_url === "string"
        ) {
          setUploadProgress((current) => ({ ...current, [field]: 100 }));
          resolve(payload.secure_url);
          return;
        }

        reject(
          new Error(
            payload.error?.message || "Cloudinary upload failed for document"
          )
        );
      };

      xhr.onerror = () => {
        reject(new Error("Document upload failed due to a network error"));
      };

      xhr.send(uploadBody);
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setUploadStatus(null);
    setUploadProgress({});

    try {
      const formData = new FormData(e.currentTarget);

      const selectedDocuments: Array<{
        field: DocumentField;
        label: (typeof DOCUMENT_CONFIG)[number]["label"];
        file: File;
      }> = [];

      for (const { field, label } of DOCUMENT_CONFIG) {
        const rawValue = formData.get(field);
        if (!(rawValue instanceof File) || rawValue.size === 0) continue;
        selectedDocuments.push({
          field,
          label,
          file: rawValue,
        });
      }

      if (selectedDocuments.length > MAX_FILE_COUNT) {
        throw new Error(`Maximum ${MAX_FILE_COUNT} files can be uploaded`);
      }

      for (const { field, file } of selectedDocuments) {
        if (!ALLOWED_MIME_TYPE_SET.has(file.type)) {
          throw new Error(
            `${field} must be one of: JPEG, PNG, or PDF. Received ${file.type}`
          );
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(
            `${field} exceeds ${formatBytes(MAX_FILE_SIZE_BYTES)} limit`
          );
        }
      }

      for (let index = 0; index < selectedDocuments.length; index += 1) {
        const { field, label, file } = selectedDocuments[index];
        setUploadStatus(
          `Uploading ${index + 1} of ${selectedDocuments.length}: ${label}`
        );
        const secureUrl = await uploadDocument(field, file);
        formData.set(field, secureUrl);
      }

      if (selectedDocuments.length > 0) {
        setUploadStatus("Submitting KYC verification...");
      }

      await onSubmit(formData);
      setUploadStatus(null);
    } catch (error: any) {
      setFormError(error?.message || "Failed to submit KYC verification");
      setUploadStatus(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Identity Verification</h2>
        {statusInfo && (
          <div
            className={`inline-block px-3 py-1 rounded text-sm bg-${statusInfo.color}-100 text-${statusInfo.color}-800`}
          >
            {statusInfo.message}
          </div>
        )}
      </div>
      {formError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      {currentStatus === "ACCEPTED" ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-green-800 font-semibold">
            Your identity has been verified
          </p>
          <p className="text-sm text-green-600 mt-2">
            You can now access higher withdrawal limits
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 1: Personal Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <input
                  name="first_name"
                  placeholder="First Name"
                  required
                  className="px-3 py-2 border rounded"
                />
                <input
                  name="last_name"
                  placeholder="Last Name"
                  required
                  className="px-3 py-2 border rounded"
                />
              </div>

              <input
                name="email_address"
                type="email"
                placeholder="Email Address"
                required
                className="w-full px-3 py-2 border rounded"
              />

              <input
                name="phone_number"
                type="tel"
                placeholder="Phone Number"
                className="w-full px-3 py-2 border rounded"
              />

              <input
                name="birth_date"
                type="date"
                placeholder="Date of Birth"
                className="w-full px-3 py-2 border rounded"
              />

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
              >
                Next: Address
              </button>
            </div>
          )}

          {/* Step 2: Address */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 2: Address</h3>

              <input
                name="address_line_1"
                placeholder="Street Address"
                className="w-full px-3 py-2 border rounded"
              />

              <div className="grid grid-cols-2 gap-4">
                <input
                  name="address_city"
                  placeholder="City"
                  className="px-3 py-2 border rounded"
                />
                <select
                  name="address_country_code"
                  required
                  className="px-3 py-2 border rounded"
                >
                  <option value="">Select Country</option>
                  <option value="NG">Nigeria</option>
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 border py-2 rounded hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
                >
                  Next: Documents
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Documents */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 3: Identity Documents</h3>

              <select
                name="id_type"
                className="w-full px-3 py-2 border rounded"
              >
                <option value="passport">Passport</option>
                <option value="drivers_license">Driver's License</option>
                <option value="national_id">National ID</option>
              </select>

              <input
                name="id_number"
                placeholder="ID Number"
                className="w-full px-3 py-2 border rounded"
              />

              {DOCUMENT_CONFIG.map(({ field, label, required }) => (
                <div key={field} className="space-y-2">
                  <label className="block text-sm font-medium">{label}</label>
                  <input
                    name={field}
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    required={required}
                    className="w-full"
                  />
                </div>
              ))}

              <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                Accepted formats: JPEG, PNG, PDF. Maximum {MAX_FILE_COUNT} files
                total, up to {formatBytes(MAX_FILE_SIZE_BYTES)} per file.
              </div>

              {uploadStatus && (
                <div className="space-y-2 rounded border border-slate-200 p-3">
                  <p className="text-xs text-slate-700">{uploadStatus}</p>
                  {uploadProgressRows.map(({ field, label }) => {
                    const progress = uploadProgress[field] ?? 0;
                    return (
                      <div key={field} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>{label}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded bg-slate-200">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={loading}
                  className="flex-1 border py-2 rounded hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? "Uploading & Submitting..." : "Submit for Verification"}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
        <strong>Privacy Note:</strong> Your information is sent via encrypted
        channels (HTTPS) to our compliance partner. We never store your ID
        documents on our servers.
      </div>
    </div>
  );
}
