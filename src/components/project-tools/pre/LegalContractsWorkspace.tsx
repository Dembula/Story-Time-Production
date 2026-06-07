"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Lock, Save, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToolActionError } from "@/components/project-tools/tool-action-error";
import { mutationErrorMessage, projectToolFetch, projectToolQueryFn } from "@/lib/project-tool-fetch";
import {
  EDITABLE_CONTRACT_FIELDS,
  buildRenderedContract,
  emptyFieldValues,
  isContractEditable,
  isContractViewOnly,
  mergeFieldValues,
  projectFieldValues,
  resourceFieldValues,
  resourceKindForTemplateType,
  templateTypeForResourceKind,
  type ContractFieldValues,
  type ContractResourceKind,
} from "@/lib/contract-prefill";
import {
  deleteLocalContractDraft,
  listLocalContractDrafts,
  saveLocalContractDraft,
  type LocalContractDraft,
} from "@/lib/contract-local-drafts";

type ContractTemplateMeta = {
  type: string;
  label: string;
  description: string;
  body: string;
  placeholders: string[];
  resourceKinds: string[];
  legalReferences: string[];
};

type ContractRow = {
  id: string;
  type: string;
  normalizedType: string;
  status: string;
  statusTone: "slate" | "blue" | "amber" | "emerald" | "red";
  editable: boolean;
  viewOnly: boolean;
  subject: string | null;
  createdAt: string;
  latestVersion: { id: string; version: number; terms: string; changeNotes: string | null; createdAt: string } | null;
  versions: Array<{ id: string; version: number; changeNotes: string | null; createdAt: string }>;
  signatures: Array<{ id: string; name: string; role: string | null; signedAt: string }>;
  signaturesCount: number;
  actor?: { id: string; name: string } | null;
  crewTeam?: { id: string; name: string } | null;
  location?: { id: string; name: string } | null;
  vendorName?: string | null;
};

type ResourceOption = {
  id: string;
  kind: string;
  label: string;
  partyName: string;
  partyType: string;
  role: string;
  rate: string;
  paymentTerms: string;
  startDate: string;
  endDate: string;
  projectInvolvement: string;
  locationName: string;
  equipmentList: string;
  shootDaysCount: string;
  serviceDuration: string;
};

type FilterTab = "ALL" | "DRAFT" | "SENT" | "SIGNED" | "REJECTED";

interface LegalContractsWorkspaceProps {
  projectId?: string;
  title: string;
}

export function LegalContractsWorkspace({ projectId, title }: LegalContractsWorkspaceProps) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const hasProject = !!projectId;
  const deepLinkTemplate = searchParams.get("templateType") ?? "";
  const deepLinkResourceType = searchParams.get("resourceType") ?? "";
  const deepLinkResourceId = searchParams.get("resourceId") ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["project-contracts", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/contracts`),
    enabled: hasProject,
  });

  const { data: standaloneTemplates } = useQuery({
    queryKey: ["contract-templates-standalone"],
    queryFn: projectToolQueryFn("/api/creator/contracts/templates"),
    enabled: !hasProject,
  });

  const templates = ((hasProject ? data?.templates : standaloneTemplates?.templates) ?? []) as ContractTemplateMeta[];
  const contracts = (data?.contracts ?? []) as ContractRow[];
  const resourceContext = data?.resourceContext as
    | {
        project: {
          id: string;
          title: string;
          productionCompany: string;
          startDate: string;
          endDate: string;
          shootDaysCount: number;
        };
        resources: Record<string, ResourceOption[]>;
      }
    | undefined;
  const metrics = (data?.metrics ?? {
    total: 0,
    signed: 0,
    sent: 0,
    drafts: 0,
    rejected: 0,
    unconfirmed: 0,
  }) as { total: number; signed: number; sent: number; drafts: number; rejected: number; unconfirmed: number };

  const [filterTab, setFilterTab] = useState<FilterTab>("ALL");
  const [portalMessage, setPortalMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [localDrafts, setLocalDrafts] = useState<LocalContractDraft[]>([]);

  const [newType, setNewType] = useState("ACTOR_AGREEMENT");
  const [resourceType, setResourceType] = useState<ContractResourceKind>("ACTOR");
  const [resourceId, setResourceId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [fields, setFields] = useState<ContractFieldValues>(emptyFieldValues());
  const [editorTerms, setEditorTerms] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const selectedTemplate = templates.find((t) => t.type === newType) ?? templates[0] ?? null;

  const selectedResources = useMemo(() => {
    if (!resourceContext?.resources) return [] as ResourceOption[];
    const key =
      resourceType === "ACTOR"
        ? "actors"
        : resourceType === "CREW"
          ? "crew"
          : resourceType === "LOCATION"
            ? "locations"
            : resourceType === "EQUIPMENT"
              ? "equipment"
              : resourceType === "CATERING"
                ? "catering"
                : resourceType === "FUNDING"
                  ? "funding"
                  : "";
    if (!key) return [];
    return (resourceContext.resources[key] ?? []) as ResourceOption[];
  }, [resourceContext, resourceType]);

  const selectedResource = selectedResources.find((r) => r.id === resourceId) ?? null;
  const selectedContract = contracts.find((c) => c.id === selectedContractId) ?? null;
  const isEditorViewOnly = selectedContract ? isContractViewOnly(selectedContract.status) : false;
  const isEditorEditable = selectedContract ? isContractEditable(selectedContract.status) : true;

  const refreshLocalDrafts = useCallback(() => {
    setLocalDrafts(listLocalContractDrafts());
  }, []);

  useEffect(() => {
    refreshLocalDrafts();
  }, [refreshLocalDrafts]);

  useEffect(() => {
    if (deepLinkTemplate) {
      setNewType(deepLinkTemplate);
      setResourceType(resourceKindForTemplateType(deepLinkTemplate));
      setShowComposer(true);
    }
    if (deepLinkResourceId) setResourceId(deepLinkResourceId);
    if (deepLinkResourceType) setResourceType(deepLinkResourceType as ContractResourceKind);
  }, [deepLinkTemplate, deepLinkResourceId, deepLinkResourceType]);

  useEffect(() => {
    if (!showComposer) return;
    setNewType((prev) => prev || selectedTemplate?.type || "ACTOR_AGREEMENT");
  }, [showComposer, selectedTemplate?.type]);

  useEffect(() => {
    if (!showComposer) return;
    const templateKind = resourceKindForTemplateType(newType);
    if (resourceType !== templateKind && resourceType !== "GENERAL") {
      setResourceType(templateKind);
    }
  }, [newType, resourceType, showComposer]);

  const rebuildPreview = useCallback(
    async (nextFields: ContractFieldValues) => {
      if (!selectedTemplate) return;
      setPreviewLoading(true);
      try {
        const res = await projectToolFetch<{ rendered: string; fields: ContractFieldValues }>(
          "/api/creator/contracts/preview",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              templateType: newType,
              projectId: projectId ?? null,
              resourceType,
              resourceId: resourceId || null,
              fields: nextFields,
            }),
          },
        );
        setFields(res.fields);
        setEditorTerms(res.rendered);
      } catch (err) {
        setEditorTerms(
          buildRenderedContract(newType, nextFields, selectedTemplate.body),
        );
      } finally {
        setPreviewLoading(false);
      }
    },
    [newType, projectId, resourceId, resourceType, selectedTemplate],
  );

  useEffect(() => {
    if (!showComposer || !selectedTemplate) return;
    let merged = emptyFieldValues();
    if (resourceContext?.project) {
      merged = mergeFieldValues(merged, projectFieldValues(resourceContext.project));
    }
    if (selectedResource) {
      merged = mergeFieldValues(merged, resourceFieldValues(selectedResource as Parameters<typeof resourceFieldValues>[0]));
    }
    void rebuildPreview(merged);
  }, [showComposer, selectedTemplate, resourceContext, selectedResource, rebuildPreview]);

  useEffect(() => {
    if (selectedResources.length === 0) {
      setResourceId("");
      return;
    }
    if (!resourceId || !selectedResources.some((r) => r.id === resourceId)) {
      setResourceId(selectedResources[0].id);
    }
  }, [resourceId, selectedResources]);

  useEffect(() => {
    if (selectedContract?.latestVersion?.terms) {
      setEditorTerms(selectedContract.latestVersion.terms);
    }
  }, [selectedContract?.id, selectedContract?.latestVersion?.terms]);

  const filteredContracts = useMemo(() => {
    if (filterTab === "ALL") return contracts;
    if (filterTab === "DRAFT") return contracts.filter((c) => c.status === "DRAFT");
    if (filterTab === "SENT") return contracts.filter((c) => c.status === "SENT" || c.status === "VIEWED");
    if (filterTab === "SIGNED") return contracts.filter((c) => isContractViewOnly(c.status));
    if (filterTab === "REJECTED") return contracts.filter((c) => c.status === "REJECTED" || c.status === "CHANGES_REQUESTED");
    return contracts;
  }, [contracts, filterTab]);

  const createMutation = useMutation({
    mutationFn: async (sendContract?: boolean) => {
      if (!hasProject) throw new Error("Link a project to save this contract to your workspace.");
      return projectToolFetch(`/api/creator/projects/${projectId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateType: newType,
          resourceType,
          resourceId: resourceId || null,
          subject: newSubject || null,
          fields,
          terms: editorTerms,
          sendContract: !!sendContract,
        }),
      });
    },
    onMutate: () => setActionError(""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-contracts", projectId] });
      setPortalMessage("Contract saved to project.");
      setShowComposer(false);
      setSelectedContractId(null);
    },
    onError: (err) => setActionError(mutationErrorMessage(err, "Could not save contract.")),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const draft = saveLocalContractDraft({
        templateType: newType,
        resourceType,
        resourceId,
        subject: newSubject,
        fields,
        templateBody: selectedTemplate?.body ?? "",
        renderedPreview: editorTerms,
      });
      return draft;
    },
    onSuccess: () => {
      refreshLocalDrafts();
      setPortalMessage("Draft saved on this device. Link a project to store it in your workspace.");
    },
    onError: (err) => setActionError(mutationErrorMessage(err, "Could not save local draft.")),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; terms?: string; status?: string; reopenAsDraft?: boolean; changeNotes?: string }) => {
      return projectToolFetch(`/api/creator/projects/${projectId}/contracts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onMutate: () => setActionError(""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-contracts", projectId] });
      setPortalMessage("Contract updated.");
    },
    onError: (err) => setActionError(mutationErrorMessage(err, "Could not update contract.")),
  });

  const contractActionMutation = useMutation({
    mutationFn: async ({
      contractId,
      kind,
      action,
    }: {
      contractId: string;
      kind: "status" | "respond";
      action: string;
    }) => {
      if (kind === "status") {
        return projectToolFetch(`/api/creator/projects/${projectId}/contracts`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: contractId, status: action }),
        });
      }
      return projectToolFetch(`/api/creator/projects/${projectId}/contracts/${contractId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-contracts", projectId] });
      setPortalMessage("Contract status updated.");
    },
    onError: (err) => setActionError(mutationErrorMessage(err, "Could not update contract status.")),
  });

  function toneClasses(tone: ContractRow["statusTone"]) {
    if (tone === "emerald") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    if (tone === "blue") return "border-sky-500/40 bg-sky-500/10 text-sky-200";
    if (tone === "amber") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    if (tone === "red") return "border-rose-500/40 bg-rose-500/10 text-rose-200";
    return "border-slate-600 bg-slate-800/70 text-slate-200";
  }

  function downloadTerms(label: string, terms: string) {
    const blob = new Blob([terms], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openLocalDraft(draft: LocalContractDraft) {
    setNewType(draft.templateType);
    setResourceType(draft.resourceType as ContractResourceKind);
    setResourceId(draft.resourceId);
    setNewSubject(draft.subject);
    setFields(draft.fields);
    setEditorTerms(draft.renderedPreview);
    setShowComposer(true);
    setSelectedContractId(null);
  }

  function updateField(key: keyof ContractFieldValues, value: string) {
    const next = { ...fields, [key]: value };
    setFields(next);
    if (selectedTemplate) {
      setEditorTerms(buildRenderedContract(newType, next, selectedTemplate.body));
    }
  }

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Template-driven agreements for cast, crew, locations, equipment, catering, and funding — with South African
              production law references. Link a project to auto-fill rates, shoot days, and counterparty details from your
              pipeline.
            </p>
            {!hasProject && (
              <p className="mt-2 text-xs text-amber-200/90">
                No project linked — fields stay empty for you to complete. Save device drafts locally, or link a project above
                to persist contracts in your workspace.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                setShowComposer(true);
                setSelectedContractId(null);
                if (!newType) setNewType("ACTOR_AGREEMENT");
              }}
            >
              New contract
            </Button>
          </div>
        </div>
      </header>

      {portalMessage && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {portalMessage}
        </p>
      )}
      <ToolActionError message={actionError} onDismiss={() => setActionError("")} />

      {hasProject && (
        <div className="grid gap-2 md:grid-cols-5">
          {[
            ["Total", metrics.total, "text-white"],
            ["Drafts", metrics.drafts, "text-slate-200"],
            ["Sent", metrics.sent, "text-sky-300"],
            ["Signed", metrics.signed, "text-emerald-300"],
            ["Rejected", metrics.rejected, "text-rose-300"],
          ].map(([label, val, cls]) => (
            <div key={label as string} className="creator-glass-panel p-3 text-xs">
              <p className="text-slate-400">{label}</p>
              <p className={`mt-1 text-xl font-semibold ${cls}`}>{val as number}</p>
            </div>
          ))}
        </div>
      )}

      {!hasProject && localDrafts.length > 0 && (
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Device drafts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {localDrafts.map((draft) => (
              <div key={draft.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs">
                <div>
                  <p className="text-white">{draft.subject || draft.templateType.replaceAll("_", " ")}</p>
                  <p className="text-slate-500">Updated {new Date(draft.updatedAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-7 border-slate-700 text-[10px]" onClick={() => openLocalDraft(draft)}>
                    Reopen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-slate-700 text-[10px]"
                    onClick={() => {
                      deleteLocalContractDraft(draft.id);
                      refreshLocalDrafts();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {showComposer && (
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Contract composer</CardTitle>
            <button type="button" onClick={() => setShowComposer(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-3">
              <select
                value={newType}
                onChange={(e) => {
                  setNewType(e.target.value);
                  setResourceType(resourceKindForTemplateType(e.target.value));
                }}
                className="h-10 rounded-md bg-slate-900 border border-slate-700 px-2 text-sm text-white"
              >
                {templates.map((template) => (
                  <option key={template.type} value={template.type}>
                    {template.label}
                  </option>
                ))}
              </select>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value as ContractResourceKind)}
                className="h-10 rounded-md bg-slate-900 border border-slate-700 px-2 text-sm text-white"
              >
                <option value="GENERAL">General (manual entry)</option>
                <option value="ACTOR">Cast / actor</option>
                <option value="CREW">Crew</option>
                <option value="LOCATION">Location</option>
                <option value="EQUIPMENT">Equipment</option>
                <option value="CATERING">Catering</option>
                <option value="FUNDING">Funding</option>
              </select>
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                disabled={!hasProject || resourceType === "GENERAL" || selectedResources.length === 0}
                className="h-10 rounded-md bg-slate-900 border border-slate-700 px-2 text-sm text-white disabled:opacity-50"
              >
                {!hasProject || resourceType === "GENERAL" ? (
                  <option value="">Fill counterparty fields manually</option>
                ) : selectedResources.length === 0 ? (
                  <option value="">No linked resources — enter details manually</option>
                ) : (
                  selectedResources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.label}
                    </option>
                  ))
                )}
              </select>
            </div>

            {selectedTemplate && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400">
                <p>{selectedTemplate.description}</p>
                <p className="mt-1 text-slate-500">
                  Legal references: {selectedTemplate.legalReferences.join(" · ")}
                </p>
              </div>
            )}

            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Contract title (optional)"
              className="bg-slate-900 border-slate-700"
            />

            <div className="grid gap-3 md:grid-cols-2">
              {EDITABLE_CONTRACT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-[11px] text-slate-400">{field.label}</label>
                  {field.multiline ? (
                    <textarea
                      value={fields[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      rows={3}
                      className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white"
                    />
                  ) : (
                    <Input
                      value={fields[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      placeholder={hasProject ? "Auto-filled when linked" : "Enter manually"}
                      className="h-9 bg-slate-900 border-slate-700 text-xs"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-slate-400 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Generated contract preview
                </label>
                {previewLoading && <span className="text-[10px] text-slate-500">Refreshing…</span>}
              </div>
              <textarea
                value={editorTerms}
                onChange={(e) => setEditorTerms(e.target.value)}
                rows={16}
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200 font-mono leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="border-slate-700" onClick={() => setShowComposer(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-600"
                onClick={() => saveDraftMutation.mutate()}
                disabled={saveDraftMutation.isPending}
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                Save device draft
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => createMutation.mutate(false)}
                disabled={createMutation.isPending || !hasProject}
                title={!hasProject ? "Link a project to save to workspace" : undefined}
              >
                Save to project
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => createMutation.mutate(true)}
                disabled={createMutation.isPending || !hasProject}
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                Save + send
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedContract && (
        <Card className="creator-glass-panel border border-orange-500/30 bg-orange-500/[0.04] shadow-none">
          <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                {isEditorViewOnly && <Lock className="w-3.5 h-3.5 text-emerald-300" />}
                {selectedContract.subject ?? selectedContract.normalizedType.replaceAll("_", " ")}
              </CardTitle>
              <p className="text-[11px] text-slate-400 mt-1">
                Status: {selectedContract.status} · Version {selectedContract.latestVersion?.version ?? 0}
                {isEditorViewOnly ? " · View only (signed)" : isEditorEditable ? " · Editable" : ""}
              </p>
            </div>
            <button type="button" onClick={() => setSelectedContractId(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedContract.signatures.length > 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100">
                Signatures:{" "}
                {selectedContract.signatures.map((s) => `${s.name}${s.role ? ` (${s.role})` : ""}`).join(" · ")}
              </div>
            )}
            <textarea
              value={editorTerms}
              onChange={(e) => setEditorTerms(e.target.value)}
              readOnly={isEditorViewOnly}
              rows={18}
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200 font-mono leading-relaxed read-only:opacity-90"
            />
            <div className="flex flex-wrap gap-2">
              {isEditorEditable && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-xs"
                  onClick={() =>
                    updateMutation.mutate({
                      id: selectedContract.id,
                      terms: editorTerms,
                      changeNotes: "Manual revision",
                    })
                  }
                  disabled={updateMutation.isPending}
                >
                  Save revision
                </Button>
              )}
              {(selectedContract.status === "REJECTED" || selectedContract.status === "CHANGES_REQUESTED") && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-amber-500/50 text-amber-200 text-xs"
                  onClick={() =>
                    updateMutation.mutate({
                      id: selectedContract.id,
                      reopenAsDraft: true,
                      terms: editorTerms,
                      changeNotes: "Reopened after rejection/changes request",
                    })
                  }
                >
                  Reopen as draft
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-700 text-xs"
                onClick={() =>
                  downloadTerms(selectedContract.subject ?? "contract", editorTerms)
                }
              >
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasProject && (
        <>
          <div className="flex flex-wrap gap-2">
            {(["ALL", "DRAFT", "SENT", "SIGNED", "REJECTED"] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterTab(tab)}
                className={`rounded-full px-3 py-1 text-[11px] border ${
                  filterTab === tab
                    ? "border-orange-500/50 bg-orange-500/15 text-orange-100"
                    : "border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {isLoading ? (
            <Skeleton className="h-48 bg-slate-800/60" />
          ) : (
            <div className="creator-glass-panel p-3 space-y-2">
              {filteredContracts.length === 0 ? (
                <p className="text-xs text-slate-500 p-4">No contracts in this view yet.</p>
              ) : (
                filteredContracts.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-3 text-xs md:text-sm space-y-2"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-0.5">
                        <p className="text-white font-medium">
                          {c.normalizedType.replaceAll("_", " ")}{" "}
                          {c.subject ? <span className="text-slate-300">· {c.subject}</span> : null}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {c.actor && <span>Actor: {c.actor.name}</span>}
                          {c.crewTeam && <span>{c.actor ? " · " : ""}Crew: {c.crewTeam.name}</span>}
                          {c.location && <span>{(c.actor || c.crewTeam) ? " · " : ""}Location: {c.location.name}</span>}
                          {c.vendorName && <span>Vendor: {c.vendorName}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] ${toneClasses(c.statusTone)}`}>
                          {c.status}
                        </span>
                        <span className="text-[11px] text-slate-500">v{c.latestVersion?.version ?? 0}</span>
                      </div>
                    </div>
                    <p className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5 text-[11px] text-slate-300 whitespace-pre-wrap line-clamp-4">
                      {c.latestVersion?.terms ?? "No terms yet."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-slate-700 px-2 text-[10px]"
                        onClick={() => {
                          setSelectedContractId(c.id);
                          setShowComposer(false);
                        }}
                      >
                        {c.viewOnly ? "View" : "Open"}
                      </Button>
                      {c.status === "DRAFT" && (
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 bg-orange-500 hover:bg-orange-600 text-[10px]"
                          onClick={() =>
                            contractActionMutation.mutate({ contractId: c.id, kind: "status", action: "SENT" })
                          }
                          disabled={contractActionMutation.isPending}
                        >
                          Send
                        </Button>
                      )}
                      {!c.viewOnly && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 border-emerald-600/60 px-2 text-[10px] text-emerald-200"
                            onClick={() =>
                              contractActionMutation.mutate({ contractId: c.id, kind: "respond", action: "ACCEPT" })
                            }
                            disabled={contractActionMutation.isPending}
                          >
                            Sign
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 border-rose-600/60 px-2 text-[10px] text-rose-200"
                            onClick={() =>
                              contractActionMutation.mutate({ contractId: c.id, kind: "respond", action: "REJECT" })
                            }
                            disabled={contractActionMutation.isPending}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-slate-700 px-2 text-[10px]"
                        onClick={() => downloadTerms(c.subject ?? "contract", c.latestVersion?.terms ?? "")}
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
