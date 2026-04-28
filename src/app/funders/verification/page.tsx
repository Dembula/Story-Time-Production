"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { validateIdOrPassportByCountry } from "@/lib/kyc-validation";
import Link from "next/link";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE = 12 * 1024 * 1024;
const STEPS = [
  "Basic Identity",
  "Address Information",
  "Identity Verification",
  "Business / Creator Verification",
  "Financial Information",
  "Risk & Compliance",
] as const;

type KycForm = {
  basicIdentity: {
    fullName: string;
    idNumber: string;
    dateOfBirth: string;
    nationality: string;
    phoneNumber: string;
    emailAddress: string;
  };
  addressInfo: {
    residentialAddress: string;
    city: string;
    provinceState: string;
    postalCode: string;
    country: string;
  };
  identityVerification: {
    idFrontUrl: string;
    idBackUrl: string;
    selfieUrl: string;
  };
  businessVerification: {
    isBusinessApplicant: boolean;
    companyName: string;
    registrationNumber: string;
    roleInCompany: string;
    companyDocsUrl: string;
    proofOfAddressUrl: string;
  };
  financialInfo: {
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    accountType: string;
    incomeRange: string;
    sourceOfFunds: string;
  };
  riskCompliance: {
    politicallyExposedPerson: boolean;
    sanctionsDeclarationAccepted: boolean;
    termsAccepted: boolean;
    popiaConsentAccepted: boolean;
  };
};

const EMPTY_FORM: KycForm = {
  basicIdentity: { fullName: "", idNumber: "", dateOfBirth: "", nationality: "", phoneNumber: "", emailAddress: "" },
  addressInfo: { residentialAddress: "", city: "", provinceState: "", postalCode: "", country: "" },
  identityVerification: { idFrontUrl: "", idBackUrl: "", selfieUrl: "" },
  businessVerification: {
    isBusinessApplicant: false,
    companyName: "",
    registrationNumber: "",
    roleInCompany: "",
    companyDocsUrl: "",
    proofOfAddressUrl: "",
  },
  financialInfo: { bankName: "", accountHolderName: "", accountNumber: "", accountType: "", incomeRange: "", sourceOfFunds: "" },
  riskCompliance: { politicallyExposedPerson: false, sanctionsDeclarationAccepted: false, termsAccepted: false, popiaConsentAccepted: false },
};

function maskId(value: string): string {
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 500 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ratio = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.floor(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.floor(bitmap.height * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

async function uploadKycFile(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error("Only JPG, PNG, or PDF files are allowed.");
  if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds 12MB limit.");
  const prepared = await compressImageIfNeeded(file);
  const fd = new FormData();
  fd.append("file", prepared);
  const res = await fetch("/api/upload/kyc-document", { method: "POST", body: fd });
  const body = (await res.json().catch(() => ({}))) as { storageRef?: string; error?: string };
  if (!res.ok || !body.storageRef) throw new Error(body.error || "Upload failed.");
  return body.storageRef;
}

function UploadField({
  label,
  value,
  busy,
  onUploaded,
}: {
  label: string;
  value: string;
  busy: boolean;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");

  async function handleFile(file: File | null) {
    if (!file) return;
    setError("");
    try {
      const url = await uploadKycFile(file);
      onUploaded(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-300">{label}</label>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className="rounded-xl border border-dashed border-slate-600 bg-slate-900/70 p-4 text-center"
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => {
            void handleFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-slate-400">Drag & drop or</p>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="mt-2 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60">
          {busy ? "Uploading..." : "Upload file"}
        </button>
        <p className="mt-2 text-[11px] text-slate-500">JPG, PNG, PDF · Max 12MB · Images auto-compressed</p>
      </div>
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
      {value ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
          <span>Uploaded</span>
          <span className="text-slate-400">Stored in private vault</span>
          <button type="button" className="text-red-300 underline" onClick={() => onUploaded("")}>
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function FunderVerificationPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<KycForm>(EMPTY_FORM);
  const [error, setError] = useState("");

  const { data } = useQuery({
    queryKey: ["funder-verification"],
    queryFn: async () => fetch("/api/funders/verification").then((r) => r.json()),
  });
  useEffect(() => {
    const kyc = (data as { profile?: { kycData?: Partial<KycForm> } } | undefined)?.profile?.kycData;
    if (kyc && typeof kyc === "object") {
      setForm((prev) => ({
        ...prev,
        ...kyc,
        basicIdentity: { ...prev.basicIdentity, ...(kyc.basicIdentity ?? {}) },
        addressInfo: { ...prev.addressInfo, ...(kyc.addressInfo ?? {}) },
        identityVerification: { ...prev.identityVerification, ...(kyc.identityVerification ?? {}) },
        businessVerification: { ...prev.businessVerification, ...(kyc.businessVerification ?? {}) },
        financialInfo: { ...prev.financialInfo, ...(kyc.financialInfo ?? {}) },
        riskCompliance: { ...prev.riskCompliance, ...(kyc.riskCompliance ?? {}) },
      }));
    }
  }, [data]);

  const completion = useMemo(() => Math.round(((step + 1) / STEPS.length) * 100), [step]);

  const saveDraft = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/funders/verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: form.basicIdentity.fullName,
          entityType: form.businessVerification.isBusinessApplicant ? "COMPANY" : "INDIVIDUAL",
          kycData: form,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Could not save draft.");
      return j;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funder-verification"] }),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const documents = [
        { documentType: "ID_FRONT", documentUrl: form.identityVerification.idFrontUrl },
        { documentType: "ID_BACK", documentUrl: form.identityVerification.idBackUrl },
        { documentType: "SELFIE", documentUrl: form.identityVerification.selfieUrl },
        ...(form.businessVerification.companyDocsUrl
          ? [{ documentType: "COMPANY_REGISTRATION", documentUrl: form.businessVerification.companyDocsUrl }]
          : []),
        ...(form.businessVerification.proofOfAddressUrl
          ? [{ documentType: "PROOF_OF_ADDRESS", documentUrl: form.businessVerification.proofOfAddressUrl }]
          : []),
      ].filter((d) => d.documentUrl);
      const res = await fetch("/api/funders/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: form.basicIdentity.fullName,
          entityType: form.businessVerification.isBusinessApplicant ? "COMPANY" : "INDIVIDUAL",
          kycData: form,
          documents,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Submission failed.");
      return j;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funder-verification"] }),
  });

  function validateStep(index: number): string {
    if (index === 0 && (!form.basicIdentity.fullName || !form.basicIdentity.idNumber || !form.basicIdentity.dateOfBirth)) {
      return "Complete full name, ID/passport number, and date of birth.";
    }
    if (index === 0) {
      const idError = validateIdOrPassportByCountry(form.addressInfo.country || form.basicIdentity.nationality, form.basicIdentity.idNumber);
      if (idError) return idError;
    }
    if (index === 1 && (!form.addressInfo.residentialAddress || !form.addressInfo.city || !form.addressInfo.country)) {
      return "Complete your residential address details.";
    }
    if (index === 2 && (!form.identityVerification.idFrontUrl || !form.identityVerification.idBackUrl || !form.identityVerification.selfieUrl)) {
      return "Upload ID front, ID back, and selfie.";
    }
    if (
      index === 3 &&
      form.businessVerification.isBusinessApplicant &&
      (!form.businessVerification.companyName || !form.businessVerification.registrationNumber || !form.businessVerification.companyDocsUrl)
    ) {
      return "Business applicants must add company details and registration documents.";
    }
    if (index === 4 && (!form.financialInfo.bankName || !form.financialInfo.accountHolderName || !form.financialInfo.accountNumber)) {
      return "Complete required banking details.";
    }
    if (index === 5 && (!form.riskCompliance.sanctionsDeclarationAccepted || !form.riskCompliance.termsAccepted || !form.riskCompliance.popiaConsentAccepted)) {
      return "Accept required declarations and consent.";
    }
    return "";
  }

  async function handleNext() {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  }

  async function handleSubmit() {
    const message = validateStep(5);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    await submit.mutateAsync();
    router.push("/");
  }

  return (
    <main className="space-y-4 text-slate-100">
      <section className="rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Funder KYC Verification</h1>
            <p className="mt-1 text-sm text-slate-400">
              Complete all steps to unlock investment actions after admin approval.
            </p>
          </div>
          <Link href="/funders" className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.04]">
            Back to dashboard
          </Link>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
          <span>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </span>
          <span>{completion}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-orange-500 transition-all" style={{ width: `${completion}%` }} />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {step === 0 ? (
            <>
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Full name" value={form.basicIdentity.fullName} onChange={(e) => setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, fullName: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="ID / Passport number" value={form.basicIdentity.idNumber} onChange={(e) => setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, idNumber: e.target.value } }))} />
              <input type="date" className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={form.basicIdentity.dateOfBirth} onChange={(e) => setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, dateOfBirth: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Nationality" value={form.basicIdentity.nationality} onChange={(e) => setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, nationality: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Phone number (OTP-ready)" value={form.basicIdentity.phoneNumber} onChange={(e) => setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, phoneNumber: e.target.value } }))} />
              <input type="email" className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Email address (verification-ready)" value={form.basicIdentity.emailAddress} onChange={(e) => setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, emailAddress: e.target.value } }))} />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <input className="md:col-span-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Residential address" value={form.addressInfo.residentialAddress} onChange={(e) => setForm((s) => ({ ...s, addressInfo: { ...s.addressInfo, residentialAddress: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="City" value={form.addressInfo.city} onChange={(e) => setForm((s) => ({ ...s, addressInfo: { ...s.addressInfo, city: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Province/State" value={form.addressInfo.provinceState} onChange={(e) => setForm((s) => ({ ...s, addressInfo: { ...s.addressInfo, provinceState: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Postal code" value={form.addressInfo.postalCode} onChange={(e) => setForm((s) => ({ ...s, addressInfo: { ...s.addressInfo, postalCode: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Country" value={form.addressInfo.country} onChange={(e) => setForm((s) => ({ ...s, addressInfo: { ...s.addressInfo, country: e.target.value } }))} />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <UploadField label="ID Document (Front)" value={form.identityVerification.idFrontUrl} busy={false} onUploaded={(url) => setForm((s) => ({ ...s, identityVerification: { ...s.identityVerification, idFrontUrl: url } }))} />
              <UploadField label="ID Document (Back)" value={form.identityVerification.idBackUrl} busy={false} onUploaded={(url) => setForm((s) => ({ ...s, identityVerification: { ...s.identityVerification, idBackUrl: url } }))} />
              <div className="md:col-span-2">
                <UploadField label="Selfie for face verification" value={form.identityVerification.selfieUrl} busy={false} onUploaded={(url) => setForm((s) => ({ ...s, identityVerification: { ...s.identityVerification, selfieUrl: url } }))} />
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.businessVerification.isBusinessApplicant} onChange={(e) => setForm((s) => ({ ...s, businessVerification: { ...s.businessVerification, isBusinessApplicant: e.target.checked } }))} />
                I am applying as a business / creator company
              </label>
              {form.businessVerification.isBusinessApplicant ? (
                <>
                  <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Company name" value={form.businessVerification.companyName} onChange={(e) => setForm((s) => ({ ...s, businessVerification: { ...s.businessVerification, companyName: e.target.value } }))} />
                  <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Registration number (CIPC)" value={form.businessVerification.registrationNumber} onChange={(e) => setForm((s) => ({ ...s, businessVerification: { ...s.businessVerification, registrationNumber: e.target.value } }))} />
                  <input className="md:col-span-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Role in company" value={form.businessVerification.roleInCompany} onChange={(e) => setForm((s) => ({ ...s, businessVerification: { ...s.businessVerification, roleInCompany: e.target.value } }))} />
                  <UploadField label="Registration documents (PDF)" value={form.businessVerification.companyDocsUrl} busy={false} onUploaded={(url) => setForm((s) => ({ ...s, businessVerification: { ...s.businessVerification, companyDocsUrl: url } }))} />
                  <UploadField label="Proof of address" value={form.businessVerification.proofOfAddressUrl} busy={false} onUploaded={(url) => setForm((s) => ({ ...s, businessVerification: { ...s.businessVerification, proofOfAddressUrl: url } }))} />
                </>
              ) : null}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Bank name" value={form.financialInfo.bankName} onChange={(e) => setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, bankName: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Account holder name" value={form.financialInfo.accountHolderName} onChange={(e) => setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, accountHolderName: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Account number" value={form.financialInfo.accountNumber} onChange={(e) => setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, accountNumber: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Account type" value={form.financialInfo.accountType} onChange={(e) => setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, accountType: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Income range (optional)" value={form.financialInfo.incomeRange} onChange={(e) => setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, incomeRange: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Source of funds (optional)" value={form.financialInfo.sourceOfFunds} onChange={(e) => setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, sourceOfFunds: e.target.value } }))} />
            </>
          ) : null}

          {step === 5 ? (
            <div className="md:col-span-2 space-y-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.riskCompliance.politicallyExposedPerson} onChange={(e) => setForm((s) => ({ ...s, riskCompliance: { ...s.riskCompliance, politicallyExposedPerson: e.target.checked } }))} />
                I am a politically exposed person (PEP)
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.riskCompliance.sanctionsDeclarationAccepted} onChange={(e) => setForm((s) => ({ ...s, riskCompliance: { ...s.riskCompliance, sanctionsDeclarationAccepted: e.target.checked } }))} />
                I declare I am not sanctioned and all information is truthful
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.riskCompliance.termsAccepted} onChange={(e) => setForm((s) => ({ ...s, riskCompliance: { ...s.riskCompliance, termsAccepted: e.target.checked } }))} />
                I accept the platform terms
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.riskCompliance.popiaConsentAccepted} onChange={(e) => setForm((s) => ({ ...s, riskCompliance: { ...s.riskCompliance, popiaConsentAccepted: e.target.checked } }))} />
                I consent to POPIA-compliant data processing
              </label>
              <p className="text-xs text-slate-500">Masked ID preview: {maskId(form.basicIdentity.idNumber)}</p>
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-50">
            Back
          </button>
          <button
            type="button"
            onClick={() => saveDraft.mutate()}
            className="rounded border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200"
          >
            Save & resume later
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => void handleNext()} className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-black">
              Continue
            </button>
          ) : (
            <button type="button" onClick={() => void handleSubmit()} className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-black">
              Submit for review
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm space-y-1">
        <p className="text-slate-300">
          Current status:{" "}
          <span className="font-semibold text-white">
            {(data as { profile?: { verificationStatus?: string } } | undefined)?.profile?.verificationStatus ?? "NOT_SUBMITTED"}
          </span>
        </p>
        {(data as { profile?: { verificationStatus?: string } } | undefined)?.profile?.verificationStatus === "APPROVED" ? (
          <p className="text-emerald-300">Approved funders are routed to `/funders` on sign-in.</p>
        ) : (
          <p className="text-slate-400">
            After submission, you are sent home while your profile is under review. You can return here anytime from the Funders menu.
          </p>
        )}
      </div>
    </main>
  );
}
