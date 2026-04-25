"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyCreatorAccountVault,
  normalizeCreatorAccountVault,
  newComplianceDocumentRow,
  type CreatorAccountVaultData,
  type VaultComplianceDocument,
} from "@/lib/creator-account-vault-schema";
import {
  Activity,
  Building2,
  FileStack,
  Landmark,
  Loader2,
  Save,
  Scale,
  Shield,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";

type StudioKind = "INDIVIDUAL" | "COMPANY" | null;

/** Default cap aligned with `ACCOUNT_UPLOAD_MAX_FILE_SIZE_MB` server default (25). Larger or AV-heavy files use content-media. */
const ACCOUNT_DOC_DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

async function postUploadForm(route: "/api/upload/account-document" | "/api/upload/content-media", file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(route, { method: "POST", body: fd });
  const j = (await res.json().catch(() => ({}))) as { error?: string; publicUrl?: string };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Upload failed");
  if (!j.publicUrl) throw new Error("No file URL returned");
  return j.publicUrl;
}

async function uploadVaultFile(file: File): Promise<string> {
  const useContentMedia =
    file.type.startsWith("video/") || file.type.startsWith("audio/") || file.size > ACCOUNT_DOC_DEFAULT_MAX_BYTES;
  if (useContentMedia) {
    return postUploadForm("/api/upload/content-media", file);
  }
  return postUploadForm("/api/upload/account-document", file);
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  onSave,
  saving,
  hideSave,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  onSave?: () => void | Promise<void>;
  saving: boolean;
  hideSave?: boolean;
}) {
  return (
    <details className="group rounded-xl border border-white/10 bg-white/[0.02] open:bg-white/[0.03]">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
        <div className="min-w-0 flex-1 text-left">
          <p className="font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-slate-500 group-open:hidden">Expand</span>
        <span className="hidden text-[10px] uppercase tracking-wide text-slate-400 group-open:inline">Collapse</span>
      </summary>
      <div className="space-y-4 border-t border-white/8 px-4 pb-4 pt-3">
        {children}
        {!hideSave && onSave ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save this section
          </button>
        ) : null}
      </div>
    </details>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="storytime-input w-full px-3 py-2 text-sm"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="storytime-input w-full resize-y px-3 py-2 text-sm"
      />
    </div>
  );
}

const VAULT_MEDIA_ACCEPT =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const VAULT_UPLOAD_GUIDANCE =
  "Supported: JPG, PNG, WEBP, AVIF, GIF, HEIC/HEIF, MP4/MOV/WEBM/MKV/MPEG/AVI/WMV/M4V/HEVC, MP3/WAV/FLAC/AAC/OGG, PDF, DOC/DOCX, TXT. Max: up to 1GB for media uploads.";

function VaultMediaUpload({
  label,
  hint,
  fileUrl,
  accept,
  busy,
  onSelectFile,
}: {
  label: string;
  hint?: string;
  fileUrl: string;
  accept: string;
  busy: boolean;
  onSelectFile: (file: File) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {hint ? <p className="mb-1.5 text-[11px] text-slate-500">{hint}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.08]">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? "Uploading…" : "Upload file"}
          <input
            type="file"
            className="hidden"
            accept={accept}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (file) onSelectFile(file);
            }}
          />
        </label>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">{VAULT_UPLOAD_GUIDANCE}</p>
      {fileUrl ? (
        <p className="mt-1.5 truncate text-xs text-slate-500" title={fileUrl}>
          Stored URL:{" "}
          <a href={fileUrl} target="_blank" rel="noreferrer" className="text-orange-300 hover:underline">
            Open file
          </a>
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500">No file uploaded yet.</p>
      )}
    </div>
  );
}

export function CreatorAccountVaultHub({
  studioKind,
  onNotify,
}: {
  studioKind: StudioKind;
  onNotify: (message: string, isError?: boolean) => void;
}) {
  const [vault, setVault] = useState<CreatorAccountVaultData>(() => emptyCreatorAccountVault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploadingVaultKey, setUploadingVaultKey] = useState<string | null>(null);
  const vaultRef = useRef(vault);
  vaultRef.current = vault;
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/creator/account-vault")
      .then((r) => r.json())
      .then((body: { data?: unknown }) => {
        if (cancelled) return;
        setVault(normalizeCreatorAccountVault(body?.data));
      })
      .catch(() => {
        if (!cancelled) onNotifyRef.current("Could not load registry vault.", true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const patchVault = useCallback(
    async (fragment: Record<string, unknown>) => {
      const res = await fetch("/api/creator/account-vault", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: fragment }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; data?: unknown };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Save failed");
      if (j.data) setVault(normalizeCreatorAccountVault(j.data));
    },
    [],
  );

  const saveSection = useCallback(
    async (key: string, fragment: Record<string, unknown>) => {
      setSaving(key);
      try {
        await patchVault(fragment);
        onNotify("Saved.");
      } catch (e) {
        onNotify((e as Error).message, true);
      } finally {
        setSaving(null);
      }
    },
    [onNotify, patchVault],
  );

  const handleVaultUpload = useCallback(
    async (
      file: File,
      vaultKey: string,
      build: (url: string, prev: CreatorAccountVaultData) => { next: CreatorAccountVaultData; patch: Record<string, unknown> },
    ) => {
      setUploadingVaultKey(vaultKey);
      try {
        const url = await uploadVaultFile(file);
        const prev = vaultRef.current;
        const { next, patch } = build(url, prev);
        setVault(next);
        vaultRef.current = next;
        await patchVault(patch);
        onNotify("Uploaded and saved.");
      } catch (e) {
        onNotify((e as Error).message, true);
      } finally {
        setUploadingVaultKey(null);
      }
    },
    [onNotify, patchVault],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  const showIndividual = studioKind !== "COMPANY";
  const showCompany = studioKind === "COMPANY" || studioKind === null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
        <p>
          This <span className="text-slate-200">registry & compliance</span> vault stores structured KYC-style data
          alongside your public profile. Files you upload are stored in your workspace storage and saved here as URLs
          automatically — you do not need to paste links.
        </p>
        {studioKind === "COMPANY" ? (
          <p className="mt-2 text-xs text-slate-500">
            Company workspace: capture CIPC, directors, and UBO here. Team invites and suite access live under{" "}
            <span className="text-slate-400">Studio → Account control</span> in the sidebar.
          </p>
        ) : null}
      </div>

      {showIndividual ? (
        <SectionCard
          icon={Users}
          title="1 · Profile — individual (core identity)"
          description="Legal identity as per ID; used for payouts and compliance."
          saving={saving === "individual"}
          onSave={() => saveSection("individual", { individual: vault.individual })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full legal name (as per ID)" value={vault.individual.legalFullName} onChange={(v) => setVault((s) => ({ ...s, individual: { ...s.individual, legalFullName: v } }))} />
            <Field label="Display / stage name" value={vault.individual.displayOrStageName} onChange={(v) => setVault((s) => ({ ...s, individual: { ...s.individual, displayOrStageName: v } }))} />
            <Field label="ID / passport number" value={vault.individual.idOrPassportNumber} onChange={(v) => setVault((s) => ({ ...s, individual: { ...s.individual, idOrPassportNumber: v } }))} />
            <Field label="Date of birth" value={vault.individual.dateOfBirth} onChange={(v) => setVault((s) => ({ ...s, individual: { ...s.individual, dateOfBirth: v } }))} placeholder="YYYY-MM-DD" />
            <Field label="Nationality" value={vault.individual.nationality} onChange={(v) => setVault((s) => ({ ...s, individual: { ...s.individual, nationality: v } }))} />
            <Field label="Gender (optional)" value={vault.individual.gender} onChange={(v) => setVault((s) => ({ ...s, individual: { ...s.individual, gender: v } }))} />
            <div className="sm:col-span-2">
              <TextArea
                label="Language preferences"
                value={vault.individual.languagePreferences}
                onChange={(v) => setVault((s) => ({ ...s, individual: { ...s.individual, languagePreferences: v } }))}
                placeholder="e.g. English, isiZulu — written and spoken"
                rows={2}
              />
            </div>
          </div>
        </SectionCard>
      ) : null}

      {showCompany ? (
        <SectionCard
          icon={Building2}
          title="1 · Profile — company (core identity)"
          description="Registered entity details, ownership, and control."
          saving={saving === "company"}
          onSave={() => saveSection("company", { company: vault.company })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Registered company name" value={vault.company.registeredCompanyName} onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, registeredCompanyName: v } }))} />
            <Field label="Trading name" value={vault.company.tradingName} onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, tradingName: v } }))} />
            <Field label="CIPC registration number" value={vault.company.cipcRegistrationNumber} onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, cipcRegistrationNumber: v } }))} />
            <Field label="Company type" value={vault.company.companyType} onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, companyType: v } }))} placeholder="PTY LTD, Sole prop…" />
            <Field label="VAT number (if applicable)" value={vault.company.vatNumber} onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, vatNumber: v } }))} />
            <Field label="Industry classification" value={vault.company.industryClassification} onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, industryClassification: v } }))} />
            <Field label="Date of registration" value={vault.company.dateOfRegistration} onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, dateOfRegistration: v } }))} />
            <TextArea label="Registered address" value={vault.company.registeredAddress} onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, registeredAddress: v } }))} rows={2} />
            <TextArea label="Operating address (if different)" value={vault.company.operatingAddress} onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, operatingAddress: v } }))} rows={2} />
            <TextArea
              label="Director(s) — full names (JSON or free text)"
              value={vault.company.directorsJson}
              onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, directorsJson: v } }))}
              rows={3}
            />
            <TextArea
              label="Shareholders (names + % — JSON or free text)"
              value={vault.company.shareholdersJson}
              onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, shareholdersJson: v } }))}
              rows={3}
            />
            <div className="sm:col-span-2">
              <TextArea
                label="Ultimate beneficial owner (UBO)"
                value={vault.company.ultimateBeneficialOwner}
                onChange={(v) => setVault((s) => ({ ...s, company: { ...s.company, ultimateBeneficialOwner: v } }))}
                rows={2}
              />
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        icon={Shield}
        title="2 · Security & contact (extended)"
        description="Verification artefacts, backup contacts, and audit notes."
        saving={saving === "securityExtended"}
        onSave={() => saveSection("securityExtended", { securityExtended: vault.securityExtended })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email verification note" value={vault.securityExtended.emailVerifiedNote} onChange={(v) => setVault((s) => ({ ...s, securityExtended: { ...s.securityExtended, emailVerifiedNote: v } }))} />
          <Field label="Phone OTP verified (yes / date)" value={vault.securityExtended.phoneOtpVerified} onChange={(v) => setVault((s) => ({ ...s, securityExtended: { ...s.securityExtended, phoneOtpVerified: v } }))} />
          <Field label="Backup email" type="email" value={vault.securityExtended.backupEmail} onChange={(v) => setVault((s) => ({ ...s, securityExtended: { ...s.securityExtended, backupEmail: v } }))} />
          <TextArea label="Physical address (proof on file)" value={vault.securityExtended.physicalAddressProof} onChange={(v) => setVault((s) => ({ ...s, securityExtended: { ...s.securityExtended, physicalAddressProof: v } }))} rows={2} />
          <Field label="2FA status" value={vault.securityExtended.twoFactorEnabled} onChange={(v) => setVault((s) => ({ ...s, securityExtended: { ...s.securityExtended, twoFactorEnabled: v } }))} />
          <TextArea label="Device / session tracking (notes)" value={vault.securityExtended.deviceSessionNote} onChange={(v) => setVault((s) => ({ ...s, securityExtended: { ...s.securityExtended, deviceSessionNote: v } }))} rows={2} />
          <TextArea label="Login history (IP + device — notes)" value={vault.securityExtended.loginHistoryNote} onChange={(v) => setVault((s) => ({ ...s, securityExtended: { ...s.securityExtended, loginHistoryNote: v } }))} rows={2} />
          <TextArea label="Account activity logs (notes)" value={vault.securityExtended.activityLogNote} onChange={(v) => setVault((s) => ({ ...s, securityExtended: { ...s.securityExtended, activityLogNote: v } }))} rows={2} />
          <VaultMediaUpload
            label="Certified ID copy"
            hint="PDF, scan, photo, or short verification clip — stored as a secure URL."
            fileUrl={vault.securityExtended.individualCertifiedIdUrl}
            accept={VAULT_MEDIA_ACCEPT}
            busy={uploadingVaultKey === "sec-certified-id"}
            onSelectFile={(file) =>
              void handleVaultUpload(file, "sec-certified-id", (url, prev) => ({
                next: { ...prev, securityExtended: { ...prev.securityExtended, individualCertifiedIdUrl: url } },
                patch: { securityExtended: { individualCertifiedIdUrl: url } },
              }))
            }
          />
          <VaultMediaUpload
            label="Selfie / liveness"
            hint="Image or short video — stored as a secure URL."
            fileUrl={vault.securityExtended.individualSelfieVerificationUrl}
            accept={VAULT_MEDIA_ACCEPT}
            busy={uploadingVaultKey === "sec-selfie"}
            onSelectFile={(file) =>
              void handleVaultUpload(file, "sec-selfie", (url, prev) => ({
                next: { ...prev, securityExtended: { ...prev.securityExtended, individualSelfieVerificationUrl: url } },
                patch: { securityExtended: { individualSelfieVerificationUrl: url } },
              }))
            }
          />
          <VaultMediaUpload
            label="Proof of address"
            fileUrl={vault.securityExtended.individualProofOfAddressUrl}
            accept={VAULT_MEDIA_ACCEPT}
            busy={uploadingVaultKey === "sec-poa"}
            onSelectFile={(file) =>
              void handleVaultUpload(file, "sec-poa", (url, prev) => ({
                next: { ...prev, securityExtended: { ...prev.securityExtended, individualProofOfAddressUrl: url } },
                patch: { securityExtended: { individualProofOfAddressUrl: url } },
              }))
            }
          />
          <VaultMediaUpload
            label="COR14.3"
            fileUrl={vault.securityExtended.companyCor143Url}
            accept={VAULT_MEDIA_ACCEPT}
            busy={uploadingVaultKey === "sec-cor143"}
            onSelectFile={(file) =>
              void handleVaultUpload(file, "sec-cor143", (url, prev) => ({
                next: { ...prev, securityExtended: { ...prev.securityExtended, companyCor143Url: url } },
                patch: { securityExtended: { companyCor143Url: url } },
              }))
            }
          />
          <VaultMediaUpload
            label="COR15.1A / MOI"
            fileUrl={vault.securityExtended.companyCor151aMoiUrl}
            accept={VAULT_MEDIA_ACCEPT}
            busy={uploadingVaultKey === "sec-cor151"}
            onSelectFile={(file) =>
              void handleVaultUpload(file, "sec-cor151", (url, prev) => ({
                next: { ...prev, securityExtended: { ...prev.securityExtended, companyCor151aMoiUrl: url } },
                patch: { securityExtended: { companyCor151aMoiUrl: url } },
              }))
            }
          />
          <VaultMediaUpload
            label="Director ID bundle"
            hint="One primary file (e.g. merged PDF or scan); stored as a secure URL."
            fileUrl={vault.securityExtended.companyDirectorIdUrls}
            accept={VAULT_MEDIA_ACCEPT}
            busy={uploadingVaultKey === "sec-director-ids"}
            onSelectFile={(file) =>
              void handleVaultUpload(file, "sec-director-ids", (url, prev) => ({
                next: { ...prev, securityExtended: { ...prev.securityExtended, companyDirectorIdUrls: url } },
                patch: { securityExtended: { companyDirectorIdUrls: url } },
              }))
            }
          />
          <VaultMediaUpload
            label="Proof of business address"
            fileUrl={vault.securityExtended.companyProofOfBusinessAddressUrl}
            accept={VAULT_MEDIA_ACCEPT}
            busy={uploadingVaultKey === "sec-biz-addr"}
            onSelectFile={(file) =>
              void handleVaultUpload(file, "sec-biz-addr", (url, prev) => ({
                next: { ...prev, securityExtended: { ...prev.securityExtended, companyProofOfBusinessAddressUrl: url } },
                patch: { securityExtended: { companyProofOfBusinessAddressUrl: url } },
              }))
            }
          />
          <Field label="Tax compliance / TCS PIN" value={vault.securityExtended.companyTcsPin} onChange={(v) => setVault((s) => ({ ...s, securityExtended: { ...s.securityExtended, companyTcsPin: v } }))} />
        </div>
      </SectionCard>

      <SectionCard
        icon={Landmark}
        title="3 · Banking & payouts (extended)"
        description="Matches settlement profile; bank letter mandatory before live payouts in production."
        saving={saving === "bankingExtended"}
        onSave={() => saveSection("bankingExtended", { bankingExtended: vault.bankingExtended })}
      >
        <p className="text-xs text-amber-200/80">
          Operational banking for payouts is still saved under Banking & payouts (platform). Use this block for extended
          KYC fields and compliance uploads.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Account holder name" value={vault.bankingExtended.accountHolderName} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, accountHolderName: v } }))} />
          <Field label="Bank name" value={vault.bankingExtended.bankName} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, bankName: v } }))} />
          <Field label="Account number (vault copy)" value={vault.bankingExtended.accountNumber} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, accountNumber: v } }))} />
          <Field label="Account type" value={vault.bankingExtended.accountTypeExtended} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, accountTypeExtended: v } }))} placeholder="Cheque / savings / business" />
          <Field label="Branch code" value={vault.bankingExtended.branchCode} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, branchCode: v } }))} />
          <VaultMediaUpload
            label="Bank confirmation letter"
            hint="PDF or clear photo of the letter — stored as a secure URL."
            fileUrl={vault.bankingExtended.bankConfirmationLetterUrl}
            accept="image/*,.pdf,application/pdf"
            busy={uploadingVaultKey === "bank-letter"}
            onSelectFile={(file) =>
              void handleVaultUpload(file, "bank-letter", (url, prev) => ({
                next: { ...prev, bankingExtended: { ...prev.bankingExtended, bankConfirmationLetterUrl: url } },
                patch: { bankingExtended: { bankConfirmationLetterUrl: url } },
              }))
            }
          />
          <TextArea label="Name vs ID / registration match check" value={vault.bankingExtended.nameMatchCheckNote} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, nameMatchCheckNote: v } }))} rows={2} />
          <Field label="Tax number" value={vault.bankingExtended.taxNumber} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, taxNumber: v } }))} />
          <Field label="VAT registration notes" value={vault.bankingExtended.vatRegistrationNote} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, vatRegistrationNote: v } }))} />
          <TextArea label="Withholding tax (future)" value={vault.bankingExtended.withholdingTaxNote} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, withholdingTaxNote: v } }))} rows={2} />
          <Field label="Preferred payout schedule" value={vault.bankingExtended.payoutSchedule} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, payoutSchedule: v } }))} placeholder="weekly / monthly" />
          <Field label="Minimum payout threshold" value={vault.bankingExtended.minimumPayoutThreshold} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, minimumPayoutThreshold: v } }))} />
          <Field label="Currency" value={vault.bankingExtended.currency} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, currency: v } }))} />
          <TextArea label="Total earnings (internal notes)" value={vault.bankingExtended.totalEarningsNote} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, totalEarningsNote: v } }))} rows={2} />
          <TextArea label="Earnings per project" value={vault.bankingExtended.earningsPerProjectNote} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, earningsPerProjectNote: v } }))} rows={2} />
          <TextArea label="Pending payouts" value={vault.bankingExtended.pendingPayoutsNote} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, pendingPayoutsNote: v } }))} rows={2} />
          <TextArea label="Paid-out history" value={vault.bankingExtended.paidOutHistoryNote} onChange={(v) => setVault((s) => ({ ...s, bankingExtended: { ...s.bankingExtended, paidOutHistoryNote: v } }))} rows={2} />
        </div>
      </SectionCard>

      <SectionCard
        icon={Sparkles}
        title="4 · Public profile (extended)"
        description="Banner, skills, portfolio — complements the Public tab."
        saving={saving === "publicExtended"}
        onSave={() => saveSection("publicExtended", { publicExtended: vault.publicExtended })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <VaultMediaUpload
              label="Banner / cover (image or short video)"
              hint="Shown on your public profile — upload a file; it is stored and linked automatically."
              fileUrl={vault.publicExtended.bannerImageUrl}
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"
              busy={uploadingVaultKey === "public-banner"}
              onSelectFile={(file) =>
                void handleVaultUpload(file, "public-banner", (url, prev) => ({
                  next: { ...prev, publicExtended: { ...prev.publicExtended, bannerImageUrl: url } },
                  patch: { publicExtended: { bannerImageUrl: url } },
                }))
              }
            />
          </div>
          <TextArea label="Skills / roles" value={vault.publicExtended.skillsRoles} onChange={(v) => setVault((s) => ({ ...s, publicExtended: { ...s.publicExtended, skillsRoles: v } }))} rows={2} />
          <TextArea label="Portfolio (films / projects — notes + links)" value={vault.publicExtended.portfolioNote} onChange={(v) => setVault((s) => ({ ...s, publicExtended: { ...s.publicExtended, portfolioNote: v } }))} rows={3} />
          <TextArea label="Reputation (ratings / reviews — future)" value={vault.publicExtended.reputationNote} onChange={(v) => setVault((s) => ({ ...s, publicExtended: { ...s.publicExtended, reputationNote: v } }))} rows={2} />
        </div>
      </SectionCard>

      <SectionCard
        icon={FileStack}
        title="5 · Document & compliance center"
        description="Versioned artefacts with status; upload PDFs, images, audio, or video up to the configured limit."
        saving={saving === "documents"}
        onSave={() => saveSection("documents", { documents: vault.documents })}
      >
        <div className="space-y-3">
          {vault.documents.map((row: VaultComplianceDocument) => (
            <div key={row.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Title" value={row.title} onChange={(v) => setVault((s) => ({ ...s, documents: s.documents.map((d) => (d.id === row.id ? { ...d, title: v } : d)) }))} />
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Status</label>
                  <select
                    value={row.status}
                    onChange={(e) =>
                      setVault((s) => ({
                        ...s,
                        documents: s.documents.map((d) =>
                          d.id === row.id ? { ...d, status: e.target.value as VaultComplianceDocument["status"] } : d,
                        ),
                      }))
                    }
                    className="storytime-select w-full px-3 py-2 text-sm"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <VaultMediaUpload
                    label="Compliance file"
                    hint="Upload replaces the stored URL for this row and saves immediately."
                    fileUrl={row.url}
                    accept={VAULT_MEDIA_ACCEPT}
                    busy={uploadingVaultKey === `doc-${row.id}`}
                    onSelectFile={(file) =>
                      void handleVaultUpload(file, `doc-${row.id}`, (url, prev) => {
                        const uploadedAt = new Date().toISOString();
                        const documents = prev.documents.map((d) =>
                          d.id === row.id ? { ...d, url, uploadedAt } : d,
                        );
                        return { next: { ...prev, documents }, patch: { documents } };
                      })
                    }
                  />
                </div>
                <Field label="Kind / tag" value={row.kind} onChange={(v) => setVault((s) => ({ ...s, documents: s.documents.map((d) => (d.id === row.id ? { ...d, kind: v } : d)) }))} />
                <Field label="Expiry (YYYY-MM-DD)" value={row.expiresAt ?? ""} onChange={(v) => setVault((s) => ({ ...s, documents: s.documents.map((d) => (d.id === row.id ? { ...d, expiresAt: v } : d)) }))} />
                <TextArea label="Notes" value={row.notes ?? ""} onChange={(v) => setVault((s) => ({ ...s, documents: s.documents.map((d) => (d.id === row.id ? { ...d, notes: v } : d)) }))} rows={2} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs text-red-300 hover:underline"
                  onClick={() => setVault((s) => ({ ...s, documents: s.documents.filter((d) => d.id !== row.id) }))}
                >
                  Remove row
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="text-sm text-orange-300 hover:underline"
            onClick={() => setVault((s) => ({ ...s, documents: [...s.documents, newComplianceDocumentRow()] }))}
          >
            + Add document row
          </button>
        </div>
      </SectionCard>

      <SectionCard
        icon={Activity}
        title="6 · Platform intelligence (internal)"
        description="Captured for roadmap analytics — keep factual; not shown publicly."
        saving={saving === "platformIntel"}
        onSave={() => saveSection("platformIntel", { platformIntel: vault.platformIntel })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextArea label="Account type notes" value={vault.platformIntel.accountTypeNote} onChange={(v) => setVault((s) => ({ ...s, platformIntel: { ...s.platformIntel, accountTypeNote: v } }))} rows={2} />
          <TextArea label="Package / tier" value={vault.platformIntel.subscriptionTierNote} onChange={(v) => setVault((s) => ({ ...s, platformIntel: { ...s.platformIntel, subscriptionTierNote: v } }))} rows={2} />
          <TextArea label="Pipeline usage" value={vault.platformIntel.pipelineUsageNote} onChange={(v) => setVault((s) => ({ ...s, platformIntel: { ...s.platformIntel, pipelineUsageNote: v } }))} rows={2} />
          <TextArea label="AI tooling usage" value={vault.platformIntel.aiToolingNote} onChange={(v) => setVault((s) => ({ ...s, platformIntel: { ...s.platformIntel, aiToolingNote: v } }))} rows={2} />
          <TextArea label="Production activity" value={vault.platformIntel.productionActivityNote} onChange={(v) => setVault((s) => ({ ...s, platformIntel: { ...s.platformIntel, productionActivityNote: v } }))} rows={2} />
          <TextArea label="Engagement performance" value={vault.platformIntel.engagementNote} onChange={(v) => setVault((s) => ({ ...s, platformIntel: { ...s.platformIntel, engagementNote: v } }))} rows={2} />
        </div>
      </SectionCard>

      <SectionCard
        icon={Building2}
        title="7 · Branding & customization"
        description="Slug, colours, logo — feeds future public studio pages."
        saving={saving === "branding"}
        onSave={() => saveSection("branding", { branding: vault.branding })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Custom profile slug" value={vault.branding.customProfileSlug} onChange={(v) => setVault((s) => ({ ...s, branding: { ...s.branding, customProfileSlug: v } }))} placeholder="creator-name" />
          <VaultMediaUpload
            label="Brand logo"
            hint="PNG, JPG, WebP, or GIF — stored as a secure URL."
            fileUrl={vault.branding.brandLogoUrl}
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            busy={uploadingVaultKey === "brand-logo"}
            onSelectFile={(file) =>
              void handleVaultUpload(file, "brand-logo", (url, prev) => ({
                next: { ...prev, branding: { ...prev.branding, brandLogoUrl: url } },
                patch: { branding: { brandLogoUrl: url } },
              }))
            }
          />
          <Field label="Primary colour (hex)" value={vault.branding.brandPrimaryColor} onChange={(v) => setVault((s) => ({ ...s, branding: { ...s.branding, brandPrimaryColor: v } }))} placeholder="#FF6600" />
          <Field label="Secondary colour (hex)" value={vault.branding.brandSecondaryColor} onChange={(v) => setVault((s) => ({ ...s, branding: { ...s.branding, brandSecondaryColor: v } }))} />
          <TextArea label="Watermark (future)" value={vault.branding.watermarkNote} onChange={(v) => setVault((s) => ({ ...s, branding: { ...s.branding, watermarkNote: v } }))} rows={2} />
        </div>
      </SectionCard>

      <SectionCard
        icon={Scale}
        title="8 · Legal & consent"
        description="Record acceptance timestamps (ISO); legal text lives in site policies."
        saving={saving === "legal"}
        onSave={() => saveSection("legal", { legal: vault.legal })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Terms & conditions accepted at (ISO)" value={vault.legal.termsAcceptedAt} onChange={(v) => setVault((s) => ({ ...s, legal: { ...s.legal, termsAcceptedAt: v } }))} />
          <Field label="Privacy policy accepted at" value={vault.legal.privacyAcceptedAt} onChange={(v) => setVault((s) => ({ ...s, legal: { ...s.legal, privacyAcceptedAt: v } }))} />
          <Field label="Content ownership declaration" value={vault.legal.contentOwnershipDeclarationAt} onChange={(v) => setVault((s) => ({ ...s, legal: { ...s.legal, contentOwnershipDeclarationAt: v } }))} />
          <Field label="Revenue sharing agreement" value={vault.legal.revenueSharingAgreementAt} onChange={(v) => setVault((s) => ({ ...s, legal: { ...s.legal, revenueSharingAgreementAt: v } }))} />
          <Field label="Data usage / AI consent" value={vault.legal.dataUsageConsentAt} onChange={(v) => setVault((s) => ({ ...s, legal: { ...s.legal, dataUsageConsentAt: v } }))} />
        </div>
      </SectionCard>

      <SectionCard
        icon={Sparkles}
        title="9 · Future-ready roadmap"
        description="Structured placeholders — no automation wired yet."
        saving={saving === "future"}
        onSave={() => saveSection("future", { future: vault.future })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextArea label="KYC integrations" value={vault.future.plannedKycIntegrations} onChange={(v) => setVault((s) => ({ ...s, future: { ...s.future, plannedKycIntegrations: v } }))} rows={2} />
          <TextArea label="Bank APIs" value={vault.future.plannedBankApis} onChange={(v) => setVault((s) => ({ ...s, future: { ...s.future, plannedBankApis: v } }))} rows={2} />
          <TextArea label="Government database checks" value={vault.future.plannedGovernmentChecks} onChange={(v) => setVault((s) => ({ ...s, future: { ...s.future, plannedGovernmentChecks: v } }))} rows={2} />
          <TextArea label="Credit scoring" value={vault.future.plannedCreditScoring} onChange={(v) => setVault((s) => ({ ...s, future: { ...s.future, plannedCreditScoring: v } }))} rows={2} />
          <TextArea label="Funding eligibility scoring" value={vault.future.plannedFundingEligibility} onChange={(v) => setVault((s) => ({ ...s, future: { ...s.future, plannedFundingEligibility: v } }))} rows={2} />
        </div>
      </SectionCard>
    </div>
  );
}
