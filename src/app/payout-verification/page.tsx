"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { validateIdOrPassportByCountry } from "@/lib/kyc-validation";
import { applyKycDocumentToPayload } from "@/lib/kyc-form-documents";
import { KycDocumentUploadField } from "@/components/kyc/kyc-document-upload-field";
import { payoutKycHomePath } from "@/lib/payout-kyc-shared";
import { useSession } from "next-auth/react";
import Link from "next/link";
const STEPS = [
  "Basic Identity",
  "Address Information",
  "Identity Verification",
  "Business / Company Verification",
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

export default function PayoutVerificationPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const homePath = payoutKycHomePath(role);
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<KycForm>(EMPTY_FORM);
  const formRef = useRef(form);
  formRef.current = form;
  const [error, setError] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);

  function setKycDocument(documentType: string, url: string) {
    const next = applyKycDocumentToPayload(formRef.current, documentType, url) as KycForm;
    formRef.current = next;
    setForm(next);
    return next;
  }

  const { data } = useQuery({
    queryKey: ["payout-kyc-verification"],
    queryFn: async () => fetch("/api/payout-kyc/verification").then((r) => r.json()),
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
    mutationFn: async (draftForm: KycForm = formRef.current) => {
      const res = await fetch("/api/payout-kyc/verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: draftForm.basicIdentity.fullName,
          entityType: draftForm.businessVerification.isBusinessApplicant ? "COMPANY" : "INDIVIDUAL",
          kycData: draftForm,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Could not save draft.");
      return j;
    },
    onSuccess: () => {
      setDraftSaved(true);
      setError("");
      qc.invalidateQueries({ queryKey: ["payout-kyc-verification"] });
    },
    onError: (err: Error) => setError(err.message),
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
      const res = await fetch("/api/payout-kyc/verification", {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payout-kyc-verification"] }),
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

  function validateSubmission(): string {
    // Submission requires *all* required fields, not only the current risk/compliance step.
    return validateStep(0) || validateStep(1) || validateStep(2) || validateStep(3) || validateStep(4) || validateStep(5);
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
    const message = validateSubmission();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    await submit.mutateAsync();
    router.push(homePath);
  }

  const profile = (data as { profile?: { verificationStatus?: string; reviewNote?: string | null } } | undefined)?.profile;
  const status = profile?.verificationStatus ?? "NOT_SUBMITTED";

  return (
    <main className="space-y-4 text-slate-100">
      <section className="rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Payout verification (KYC)</h1>
            <p className="mt-1 text-sm text-slate-400">
              Required for anyone receiving marketplace payouts. You can keep using the platform while we review your
              submission — withdrawals unlock only after approval.
            </p>
          </div>
          <Link href={homePath} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.04]">
            Back to workspace
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
              <KycDocumentUploadField documentType="ID_FRONT" label="ID Document (Front)" value={form.identityVerification.idFrontUrl} persistBusy={saveDraft.isPending} onUploaded={(url) => setKycDocument("ID_FRONT", url)} onPersistDraft={() => saveDraft.mutateAsync(formRef.current)} />
              <KycDocumentUploadField documentType="ID_BACK" label="ID Document (Back)" value={form.identityVerification.idBackUrl} persistBusy={saveDraft.isPending} onUploaded={(url) => setKycDocument("ID_BACK", url)} onPersistDraft={() => saveDraft.mutateAsync(formRef.current)} />
              <div className="md:col-span-2">
                <KycDocumentUploadField documentType="SELFIE" label="Selfie for face verification" value={form.identityVerification.selfieUrl} persistBusy={saveDraft.isPending} onUploaded={(url) => setKycDocument("SELFIE", url)} onPersistDraft={() => saveDraft.mutateAsync(formRef.current)} />
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
                  <KycDocumentUploadField documentType="COMPANY_REGISTRATION" label="Registration documents (PDF)" value={form.businessVerification.companyDocsUrl} persistBusy={saveDraft.isPending} onUploaded={(url) => setKycDocument("COMPANY_REGISTRATION", url)} onPersistDraft={() => saveDraft.mutateAsync(formRef.current)} />
                  <KycDocumentUploadField documentType="PROOF_OF_ADDRESS" label="Proof of address" value={form.businessVerification.proofOfAddressUrl} persistBusy={saveDraft.isPending} onUploaded={(url) => setKycDocument("PROOF_OF_ADDRESS", url)} onPersistDraft={() => saveDraft.mutateAsync(formRef.current)} />
                </>
              ) : null}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Bank name" value={form.financialInfo.bankName} onChange={(e) => setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, bankName: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Account holder name" value={form.financialInfo.accountHolderName} onChange={(e) => setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, accountHolderName: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Account number" value={form.financialInfo.accountNumber} onChange={(e) => setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, accountNumber: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Account type (CHEQUE / SAVINGS)" value={form.financialInfo.accountType} onChange={(e) => setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, accountType: e.target.value } }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Branch code (optional)" value={(form.financialInfo as { branchCode?: string }).branchCode ?? ""} onChange={(e) => setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, branchCode: e.target.value } }))} />
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

        {draftSaved ? <p className="mt-3 text-sm text-emerald-300">Draft saved. You can return anytime from Wallet or this page.</p> : null}
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-50">
            Back
          </button>
          <button
            type="button"
            onClick={() => saveDraft.mutate(formRef.current)}
            className="rounded border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200"
          >
            Save & resume later
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => void handleNext()} className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-black">
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submit.isPending || !!validateSubmission()}
              className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              Submit for review
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm space-y-1">
        <p className="text-slate-300">
          Current status: <span className="font-semibold text-white">{status}</span>
        </p>
        {status === "REJECTED" && profile?.reviewNote ? (
          <p className="text-red-300">Rejection reason: {profile.reviewNote}</p>
        ) : null}
        {status === "APPROVED" ? (
          <p className="text-emerald-300">Your account is approved for payouts. Withdrawals and marketplace settlements can proceed.</p>
        ) : (
          <p className="text-slate-400">
            Platform access is not blocked. Payouts and withdrawals stay locked until compliance approves this application.
            Save a draft anytime and return to finish or update your submission.
          </p>
        )}
      </div>
    </main>
  );
}
