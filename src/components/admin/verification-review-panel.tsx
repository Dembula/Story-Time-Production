"use client";

import { useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { isKycStorageRefImage } from "@/lib/kyc-form-documents";

type VerificationDoc = {
  id: string;
  documentType: string;
  documentUrl: string;
  status: string;
  submittedAt?: string;
  note?: string | null;
};

type ReviewProfile = {
  id: string;
  legalName?: string | null;
  entityType?: string | null;
  verificationStatus?: string;
  riskLevel?: string | null;
  reviewNote?: string | null;
  submittedAt?: string | null;
  kycData?: Record<string, unknown> | null;
  user?: { name?: string | null; email?: string | null; role?: string | null };
  verifications?: VerificationDoc[];
};

function Field({
  label,
  value,
  mono = false,
  alwaysShow = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  /** When true, show an empty placeholder so admins know the field is missing. */
  alwaysShow?: boolean;
}) {
  const empty = !value?.trim();
  if (empty && !alwaysShow) return null;
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-sm ${empty ? "text-slate-500" : "text-slate-100"} ${mono ? "font-mono tracking-wide" : ""}`}>
        {empty ? "—" : value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-300">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function KycDataSections({ kyc }: { kyc?: Record<string, unknown> | null }) {
  if (!kyc || typeof kyc !== "object") {
    return <p className="text-xs text-slate-500">No structured application data on file.</p>;
  }

  const basic = (kyc.basicIdentity ?? {}) as Record<string, string>;
  const address = (kyc.addressInfo ?? {}) as Record<string, string>;
  const financial = (kyc.financialInfo ?? {}) as Record<string, string>;
  const business = (kyc.businessVerification ?? {}) as Record<string, string | boolean>;
  const risk = (kyc.riskCompliance ?? {}) as Record<string, boolean>;

  return (
    <div className="space-y-3">
      <Section title="Identity">
        <Field label="Full name" value={basic.fullName} />
        <Field label="ID / passport" value={basic.idNumber} />
        <Field label="Date of birth" value={basic.dateOfBirth} />
        <Field label="Nationality" value={basic.nationality} />
        <Field label="Phone" value={basic.phoneNumber} />
        <Field label="Email" value={basic.emailAddress} />
      </Section>
      <Section title="Address">
        <Field label="Street" value={address.residentialAddress} />
        <Field label="City" value={address.city} />
        <Field label="Province / state" value={address.provinceState} />
        <Field label="Postal code" value={address.postalCode} />
        <Field label="Country" value={address.country} />
      </Section>
      <Section title="Banking (full details for payouts)">
        <Field label="Bank" value={financial.bankName} alwaysShow />
        <Field label="Account holder" value={financial.accountHolderName} alwaysShow />
        <Field label="Account number" value={financial.accountNumber} mono alwaysShow />
        <Field label="Branch code" value={financial.branchCode} mono alwaysShow />
        <Field label="Account type" value={financial.accountType} alwaysShow />
        <Field label="Statement period end" value={financial.bankStatementAsOf} alwaysShow />
        <Field label="Income range" value={financial.incomeRange} />
        <Field label="Source of funds" value={financial.sourceOfFunds} />
      </Section>
      {business.isBusinessApplicant ? (
        <Section title="Business">
          <Field label="Company" value={typeof business.companyName === "string" ? business.companyName : null} />
          <Field label="Registration" value={typeof business.registrationNumber === "string" ? business.registrationNumber : null} />
          <Field label="Role" value={typeof business.roleInCompany === "string" ? business.roleInCompany : null} />
        </Section>
      ) : null}
      <Section title="Compliance">
        <Field label="PEP" value={risk.politicallyExposedPerson ? "Yes" : "No"} />
        <Field label="Sanctions declared" value={risk.sanctionsDeclarationAccepted ? "Yes" : "No"} />
        <Field label="Terms accepted" value={risk.termsAccepted ? "Yes" : "No"} />
        <Field label="POPIA consent" value={risk.popiaConsentAccepted ? "Yes" : "No"} />
      </Section>
    </div>
  );
}

function DocumentPreview({
  doc,
  signedUrlPath,
}: {
  doc: VerificationDoc;
  signedUrlPath: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadPreview() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${signedUrlPath}?verificationId=${encodeURIComponent(doc.id)}`);
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error || "Could not load document");
      setPreviewUrl(j.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load document");
    } finally {
      setLoading(false);
    }
  }

  const isImage = isKycStorageRefImage(doc.documentUrl);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">
            {doc.documentType.replaceAll("_", " ")}
          </p>
          <p className="text-[11px] text-slate-500">
            {doc.status}
            {doc.submittedAt ? ` · ${new Date(doc.submittedAt).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadPreview()}
            disabled={loading}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : "Preview"}
          </button>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                setLoading(true);
                setError("");
                try {
                  const res = await fetch(`${signedUrlPath}?verificationId=${encodeURIComponent(doc.id)}`);
                  const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
                  if (!res.ok || !j.url) throw new Error(j.error || "Could not load document");
                  setPreviewUrl(j.url);
                  window.open(j.url, "_blank", "noopener,noreferrer");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not load document");
                } finally {
                  setLoading(false);
                }
              })();
            }}
            className="inline-flex items-center gap-1 rounded border border-orange-500/40 px-2 py-1 text-xs text-orange-200 hover:bg-orange-500/10"
          >
            <ExternalLink className="h-3 w-3" /> Open
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {previewUrl && isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={doc.documentType} className="mt-3 max-h-64 w-full rounded border border-slate-700 object-contain bg-black/40" />
      ) : null}
      {previewUrl && !isImage ? (
        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-orange-300 hover:text-orange-200">
          <FileText className="h-3.5 w-3.5" /> View PDF in new tab
        </a>
      ) : null}
    </div>
  );
}

export function VerificationReviewPanel({
  profile,
  note,
  onNoteChange,
  onUnderReview,
  onApprove,
  onReject,
  busy,
  signedUrlPath,
  approveLabel = "Approve",
  syncedBanking,
}: {
  profile: ReviewProfile;
  note: string;
  onNoteChange: (value: string) => void;
  onUnderReview: () => void;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
  signedUrlPath: string;
  approveLabel?: string;
  /** Platform banking record used for EFT (shown in full for admins). */
  syncedBanking?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountType?: string | null;
    branchCode?: string | null;
    accountHolderName?: string | null;
    verifiedAt?: string | null;
  } | null;
}) {
  return (
    <div className="storytime-plan-card space-y-4 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{profile.legalName || profile.user?.name || "Unnamed applicant"}</p>
          <p className="text-xs text-slate-400">{profile.user?.email}</p>
          <p className="mt-1 text-xs text-orange-300">
            {profile.verificationStatus} · {profile.entityType ?? "INDIVIDUAL"} · Risk {profile.riskLevel ?? "LOW"}
          </p>
          {profile.submittedAt ? (
            <p className="text-[11px] text-slate-500">Submitted {new Date(profile.submittedAt).toLocaleString()}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onUnderReview}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
          >
            Under review
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="rounded border border-emerald-900 px-2 py-1 text-xs text-emerald-300 disabled:opacity-50"
          >
            {approveLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="rounded border border-red-900 px-2 py-1 text-xs text-red-300 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>

      {profile.reviewNote ? (
        <p className="rounded border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
          Prior note: {profile.reviewNote}
        </p>
      ) : null}

      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Admin notes / rejection reason"
        rows={3}
        className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
      />

      <KycDataSections kyc={profile.kycData} />

      {syncedBanking ? (
        <Section title="Synced payout banking (platform record)">
          <Field label="Bank" value={syncedBanking.bankName} alwaysShow />
          <Field label="Account holder" value={syncedBanking.accountHolderName} alwaysShow />
          <Field label="Account number" value={syncedBanking.accountNumber} mono alwaysShow />
          <Field label="Branch code" value={syncedBanking.branchCode} mono alwaysShow />
          <Field label="Account type" value={syncedBanking.accountType} alwaysShow />
          <Field
            label="Verified at"
            value={syncedBanking.verifiedAt ? new Date(syncedBanking.verifiedAt).toLocaleString() : null}
            alwaysShow
          />
        </Section>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Uploaded documents</p>
        <div className="grid gap-3 md:grid-cols-2">
          {(profile.verifications ?? []).length === 0 ? (
            <p className="text-xs text-slate-500">No documents uploaded yet.</p>
          ) : (
            (profile.verifications ?? []).map((doc) => (
              <DocumentPreview key={doc.id} doc={doc} signedUrlPath={signedUrlPath} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
