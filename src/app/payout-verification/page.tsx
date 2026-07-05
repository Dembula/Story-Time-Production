"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Building2, CheckCircle2, Landmark, ShieldCheck, UserRound } from "lucide-react";
import { validateIdOrPassportByCountry } from "@/lib/kyc-validation";
import { applyKycDocumentToPayload } from "@/lib/kyc-form-documents";
import { KycDocumentUploadField } from "@/components/kyc/kyc-document-upload-field";
import { BANK_STATEMENT_MAX_AGE_DAYS, isBankStatementRecent, payoutKycHomePath } from "@/lib/payout-kyc-shared";

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
    branchCode: string;
    incomeRange: string;
    sourceOfFunds: string;
    bankStatementAsOf: string;
    bankStatementUrl: string;
    bankConfirmationLetterUrl: string;
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
  financialInfo: {
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    accountType: "",
    branchCode: "",
    incomeRange: "",
    sourceOfFunds: "",
    bankStatementAsOf: "",
    bankStatementUrl: "",
    bankConfirmationLetterUrl: "",
  },
  riskCompliance: {
    politicallyExposedPerson: false,
    sanctionsDeclarationAccepted: false,
    termsAccepted: false,
    popiaConsentAccepted: false,
  },
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "storytime-input w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white placeholder:text-slate-500",
        "focus:border-orange-500/40 focus:outline-none focus:ring-1 focus:ring-orange-500/30",
        props.className ?? "",
      ].join(" ")}
    />
  );
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
        { documentType: "BANK_STATEMENT", documentUrl: form.financialInfo.bankStatementUrl },
        { documentType: "BANK_CONFIRMATION_LETTER", documentUrl: form.financialInfo.bankConfirmationLetterUrl },
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
      const idError = validateIdOrPassportByCountry(
        form.addressInfo.country || form.basicIdentity.nationality,
        form.basicIdentity.idNumber,
      );
      if (idError) return idError;
    }
    if (index === 1 && (!form.addressInfo.residentialAddress || !form.addressInfo.city || !form.addressInfo.country)) {
      return "Complete your residential address details.";
    }
    if (
      index === 2 &&
      (!form.identityVerification.idFrontUrl ||
        !form.identityVerification.idBackUrl ||
        !form.identityVerification.selfieUrl)
    ) {
      return "Upload ID front, ID back, and selfie.";
    }
    if (
      index === 3 &&
      form.businessVerification.isBusinessApplicant &&
      (!form.businessVerification.companyName ||
        !form.businessVerification.registrationNumber ||
        !form.businessVerification.companyDocsUrl)
    ) {
      return "Business applicants must add company details and registration documents.";
    }
    if (index === 4) {
      if (
        !form.financialInfo.bankName ||
        !form.financialInfo.accountHolderName ||
        !form.financialInfo.accountNumber ||
        !form.financialInfo.accountType ||
        !form.financialInfo.branchCode
      ) {
        return "Complete bank name, account holder, account number, account type, and branch code.";
      }
      if (!form.financialInfo.bankStatementUrl) {
        return "Upload a bank statement dated within the last 3 months.";
      }
      if (!form.financialInfo.bankConfirmationLetterUrl) {
        return "Upload a bank account confirmation letter.";
      }
      if (!isBankStatementRecent(form.financialInfo.bankStatementAsOf)) {
        return `Bank statement date must be within the last ${BANK_STATEMENT_MAX_AGE_DAYS} days (enter the statement period end date).`;
      }
    }
    if (
      index === 5 &&
      (!form.riskCompliance.sanctionsDeclarationAccepted ||
        !form.riskCompliance.termsAccepted ||
        !form.riskCompliance.popiaConsentAccepted)
    ) {
      return "Accept required declarations and consent.";
    }
    return "";
  }

  function validateSubmission(): string {
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

  const profile = (data as { profile?: { verificationStatus?: string; reviewNote?: string | null } } | undefined)
    ?.profile;
  const status = profile?.verificationStatus ?? "NOT_SUBMITTED";

  const statusTone =
    status === "APPROVED"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : status === "REJECTED"
        ? "border-red-500/30 bg-red-500/10 text-red-200"
        : status === "UNDER_REVIEW" || status === "PENDING"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
          : "border-white/10 bg-white/[0.04] text-slate-300";

  return (
    <main className="space-y-6 text-slate-100">
      <section className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Compliance</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Payout verification (KYC / KYB)
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              Required for marketplace payouts. You can keep using the platform while we review — withdrawals unlock
              only after approval. Bank verification needs a recent statement and a confirmation letter.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${statusTone}`}>
              Status: {status.replaceAll("_", " ")}
            </span>
            <Link
              href={homePath}
              className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 transition hover:border-orange-400/35 hover:bg-orange-500/10"
            >
              Back to workspace
            </Link>
          </div>
        </div>
      </section>

      <div className="storytime-plan-card overflow-hidden p-5 md:p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (i <= step) setStep(i);
                }}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                  active
                    ? "border-orange-500/50 bg-orange-500/15 text-orange-100"
                    : done
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-white/[0.03] text-slate-500",
                ].join(" ")}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="opacity-70">{i + 1}.</span>}
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="mb-5 flex items-center justify-between text-xs text-slate-400">
          <span>
            Step {step + 1} of {STEPS.length}: <span className="text-slate-200">{STEPS[step]}</span>
          </span>
          <span>{completion}%</span>
        </div>
        <div className="mb-6 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {step === 0 ? (
            <>
              <div>
                <FieldLabel>Full legal name</FieldLabel>
                <TextInput
                  placeholder="As on your ID"
                  value={form.basicIdentity.fullName}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, fullName: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>ID / passport number</FieldLabel>
                <TextInput
                  placeholder="National ID or passport"
                  value={form.basicIdentity.idNumber}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, idNumber: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Date of birth</FieldLabel>
                <TextInput
                  type="date"
                  value={form.basicIdentity.dateOfBirth}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, dateOfBirth: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Nationality</FieldLabel>
                <TextInput
                  placeholder="e.g. South African"
                  value={form.basicIdentity.nationality}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, nationality: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Phone number</FieldLabel>
                <TextInput
                  placeholder="+27…"
                  value={form.basicIdentity.phoneNumber}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, phoneNumber: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Email address</FieldLabel>
                <TextInput
                  type="email"
                  placeholder="you@example.com"
                  value={form.basicIdentity.emailAddress}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, basicIdentity: { ...s.basicIdentity, emailAddress: e.target.value } }))
                  }
                />
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="md:col-span-2">
                <FieldLabel>Residential address</FieldLabel>
                <TextInput
                  placeholder="Street address"
                  value={form.addressInfo.residentialAddress}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, addressInfo: { ...s.addressInfo, residentialAddress: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>City</FieldLabel>
                <TextInput
                  value={form.addressInfo.city}
                  onChange={(e) => setForm((s) => ({ ...s, addressInfo: { ...s.addressInfo, city: e.target.value } }))}
                />
              </div>
              <div>
                <FieldLabel>Province / state</FieldLabel>
                <TextInput
                  value={form.addressInfo.provinceState}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, addressInfo: { ...s.addressInfo, provinceState: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Postal code</FieldLabel>
                <TextInput
                  value={form.addressInfo.postalCode}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, addressInfo: { ...s.addressInfo, postalCode: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Country</FieldLabel>
                <TextInput
                  value={form.addressInfo.country}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, addressInfo: { ...s.addressInfo, country: e.target.value } }))
                  }
                />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="md:col-span-2 mb-1 flex items-center gap-2 text-sm text-slate-300">
                <UserRound className="h-4 w-4 text-orange-300" />
                Identity documents
              </div>
              <KycDocumentUploadField
                documentType="ID_FRONT"
                label="ID document (front)"
                value={form.identityVerification.idFrontUrl}
                persistBusy={saveDraft.isPending}
                onUploaded={(url) => setKycDocument("ID_FRONT", url)}
                onPersistDraft={() => saveDraft.mutateAsync(formRef.current)}
              />
              <KycDocumentUploadField
                documentType="ID_BACK"
                label="ID document (back)"
                value={form.identityVerification.idBackUrl}
                persistBusy={saveDraft.isPending}
                onUploaded={(url) => setKycDocument("ID_BACK", url)}
                onPersistDraft={() => saveDraft.mutateAsync(formRef.current)}
              />
              <div className="md:col-span-2">
                <KycDocumentUploadField
                  documentType="SELFIE"
                  label="Selfie for face verification"
                  value={form.identityVerification.selfieUrl}
                  persistBusy={saveDraft.isPending}
                  onUploaded={(url) => setKycDocument("SELFIE", url)}
                  onPersistDraft={() => saveDraft.mutateAsync(formRef.current)}
                />
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="md:col-span-2 mb-1 flex items-center gap-2 text-sm text-slate-300">
                <Building2 className="h-4 w-4 text-orange-300" />
                Business / company (KYB)
              </div>
              <label className="md:col-span-2 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={form.businessVerification.isBusinessApplicant}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      businessVerification: { ...s.businessVerification, isBusinessApplicant: e.target.checked },
                    }))
                  }
                />
                I am applying as a business / creator company
              </label>
              {form.businessVerification.isBusinessApplicant ? (
                <>
                  <div>
                    <FieldLabel>Company name</FieldLabel>
                    <TextInput
                      value={form.businessVerification.companyName}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          businessVerification: { ...s.businessVerification, companyName: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>Registration number (CIPC)</FieldLabel>
                    <TextInput
                      value={form.businessVerification.registrationNumber}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          businessVerification: { ...s.businessVerification, registrationNumber: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Role in company</FieldLabel>
                    <TextInput
                      value={form.businessVerification.roleInCompany}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          businessVerification: { ...s.businessVerification, roleInCompany: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <KycDocumentUploadField
                    documentType="COMPANY_REGISTRATION"
                    label="Registration documents (PDF)"
                    value={form.businessVerification.companyDocsUrl}
                    persistBusy={saveDraft.isPending}
                    onUploaded={(url) => setKycDocument("COMPANY_REGISTRATION", url)}
                    onPersistDraft={() => saveDraft.mutateAsync(formRef.current)}
                  />
                  <KycDocumentUploadField
                    documentType="PROOF_OF_ADDRESS"
                    label="Proof of address"
                    value={form.businessVerification.proofOfAddressUrl}
                    persistBusy={saveDraft.isPending}
                    onUploaded={(url) => setKycDocument("PROOF_OF_ADDRESS", url)}
                    onPersistDraft={() => saveDraft.mutateAsync(formRef.current)}
                  />
                </>
              ) : (
                <p className="md:col-span-2 text-sm text-slate-500">
                  Individual applicants can continue — company documents are only required for business accounts.
                </p>
              )}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <div className="md:col-span-2 mb-1 flex items-center gap-2 text-sm text-slate-300">
                <Landmark className="h-4 w-4 text-orange-300" />
                Bank account verification
              </div>
              <p className="md:col-span-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs leading-relaxed text-orange-100/90">
                Upload a <strong>bank statement</strong> dated within the last {BANK_STATEMENT_MAX_AGE_DAYS} days and a{" "}
                <strong>bank account confirmation letter</strong> on bank letterhead. These are required so we can pay
                you correctly.
              </p>
              <div>
                <FieldLabel>Bank name</FieldLabel>
                <TextInput
                  placeholder="e.g. FNB, Standard Bank, Capitec"
                  value={form.financialInfo.bankName}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, bankName: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Account holder name</FieldLabel>
                <TextInput
                  placeholder="Must match your legal name or company"
                  value={form.financialInfo.accountHolderName}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      financialInfo: { ...s.financialInfo, accountHolderName: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Account number</FieldLabel>
                <TextInput
                  placeholder="Full account number"
                  value={form.financialInfo.accountNumber}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, accountNumber: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Account type</FieldLabel>
                <TextInput
                  placeholder="CHEQUE / SAVINGS / BUSINESS"
                  value={form.financialInfo.accountType}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, accountType: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Branch code</FieldLabel>
                <TextInput
                  placeholder="e.g. 250655"
                  value={form.financialInfo.branchCode}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, branchCode: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Statement period end date</FieldLabel>
                <TextInput
                  type="date"
                  value={form.financialInfo.bankStatementAsOf}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      financialInfo: { ...s.financialInfo, bankStatementAsOf: e.target.value },
                    }))
                  }
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Must be within the last {BANK_STATEMENT_MAX_AGE_DAYS} days.
                </p>
              </div>
              <KycDocumentUploadField
                documentType="BANK_STATEMENT"
                label="Bank statement (last 3 months)"
                value={form.financialInfo.bankStatementUrl}
                persistBusy={saveDraft.isPending}
                onUploaded={(url) => setKycDocument("BANK_STATEMENT", url)}
                onPersistDraft={() => saveDraft.mutateAsync(formRef.current)}
              />
              <KycDocumentUploadField
                documentType="BANK_CONFIRMATION_LETTER"
                label="Bank account confirmation letter"
                value={form.financialInfo.bankConfirmationLetterUrl}
                persistBusy={saveDraft.isPending}
                onUploaded={(url) => setKycDocument("BANK_CONFIRMATION_LETTER", url)}
                onPersistDraft={() => saveDraft.mutateAsync(formRef.current)}
              />
              <div>
                <FieldLabel>Income range (optional)</FieldLabel>
                <TextInput
                  value={form.financialInfo.incomeRange}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, incomeRange: e.target.value } }))
                  }
                />
              </div>
              <div>
                <FieldLabel>Source of funds (optional)</FieldLabel>
                <TextInput
                  value={form.financialInfo.sourceOfFunds}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, financialInfo: { ...s.financialInfo, sourceOfFunds: e.target.value } }))
                  }
                />
              </div>
            </>
          ) : null}

          {step === 5 ? (
            <div className="md:col-span-2 space-y-3">
              <div className="mb-1 flex items-center gap-2 text-sm text-slate-300">
                <ShieldCheck className="h-4 w-4 text-orange-300" />
                Declarations
              </div>
              {(
                [
                  ["politicallyExposedPerson", "I am a politically exposed person (PEP)"],
                  ["sanctionsDeclarationAccepted", "I declare I am not sanctioned and all information is truthful"],
                  ["termsAccepted", "I accept the platform terms"],
                  ["popiaConsentAccepted", "I consent to POPIA-compliant data processing"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.riskCompliance[key]}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        riskCompliance: { ...s.riskCompliance, [key]: e.target.checked },
                      }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                <p>
                  Bank: <span className="text-slate-200">{form.financialInfo.bankName || "—"}</span>
                </p>
                <p>
                  Account: <span className="font-mono text-slate-200">{form.financialInfo.accountNumber || "—"}</span>
                  {form.financialInfo.branchCode ? (
                    <span className="text-slate-500"> · Branch {form.financialInfo.branchCode}</span>
                  ) : null}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {draftSaved ? (
          <p className="mt-4 text-sm text-emerald-300">Draft saved. You can return anytime from Wallet or this page.</p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/[0.08] pt-5">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => saveDraft.mutate(formRef.current)}
            className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.07]"
          >
            Save & resume later
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => void handleNext()}
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submit.isPending || !!validateSubmission()}
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50"
            >
              {submit.isPending ? "Submitting…" : "Submit for review"}
            </button>
          )}
        </div>
      </div>

      <div className="storytime-plan-card space-y-2 p-5 text-sm">
        <p className="text-slate-300">
          Current status: <span className="font-semibold text-white">{status.replaceAll("_", " ")}</span>
        </p>
        {status === "REJECTED" && profile?.reviewNote ? (
          <p className="text-red-300">Rejection reason: {profile.reviewNote}</p>
        ) : null}
        {status === "APPROVED" ? (
          <p className="text-emerald-300">
            Your account is approved for payouts. Withdrawals and marketplace settlements can proceed.
          </p>
        ) : (
          <p className="text-slate-400">
            Platform access is not blocked. Payouts and withdrawals stay locked until compliance approves this
            application. Save a draft anytime and return to finish or update your submission.
          </p>
        )}
      </div>
    </main>
  );
}
