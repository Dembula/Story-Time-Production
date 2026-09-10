import type { ExecutiveAlert } from "@/lib/executive/types";
import { executiveHomePath, type ExecutiveOffice } from "@/lib/executive/seat-map";

type AnomalyInput = {
  churnRiskCount: number;
  openIncidents: number;
  encodeFailed: number;
  aiErrorRatePct: number;
  revenueNetZar: number;
  priorRevenueNetZar: number | null;
};

export function detectExecutiveAnomalies(input: AnomalyInput): ExecutiveAlert[] {
  const alerts: ExecutiveAlert[] = [];

  if (input.openIncidents > 0) {
    alerts.push({
      id: "ops-incidents",
      severity: input.openIncidents >= 3 ? "CRITICAL" : "HIGH",
      title: "Open operational incidents",
      description: `${input.openIncidents} unresolved ops incident${input.openIncidents === 1 ? "" : "s"} on the platform.`,
      offices: ["CEO", "COO", "CIO"],
      href: executiveHomePath("CIO"),
      metric: "openIncidents",
      currentValue: String(input.openIncidents),
      expectedValue: "0",
    });
  }

  if (input.encodeFailed > 0) {
    alerts.push({
      id: "encode-failures",
      severity: "HIGH",
      title: "Encoding failures detected",
      description: `${input.encodeFailed} encode job${input.encodeFailed === 1 ? "" : "s"} in error state.`,
      offices: ["COO", "CIO"],
      href: executiveHomePath("CIO"),
      metric: "encodeFailed",
      currentValue: String(input.encodeFailed),
    });
  }

  if (input.aiErrorRatePct >= 10) {
    alerts.push({
      id: "ai-errors",
      severity: "MEDIUM",
      title: "Elevated AI error rate",
      description: `AI request error rate is ${input.aiErrorRatePct.toFixed(1)}% in the recent window.`,
      offices: ["CIO", "CFO"],
      href: executiveHomePath("CIO"),
      metric: "aiErrorRatePct",
      currentValue: `${input.aiErrorRatePct.toFixed(1)}%`,
      expectedValue: "< 5%",
    });
  }

  if (input.churnRiskCount > 20) {
    alerts.push({
      id: "churn-risk",
      severity: "HIGH",
      title: "Elevated subscription risk",
      description: `${input.churnRiskCount} subscriptions cancelled, past due, or scheduled to cancel.`,
      offices: ["CMO", "CEO", "CFO"],
      href: executiveHomePath("CMO"),
      metric: "churnRiskCount",
      currentValue: String(input.churnRiskCount),
    });
  }

  if (
    input.priorRevenueNetZar != null &&
    input.priorRevenueNetZar > 0 &&
    input.revenueNetZar < input.priorRevenueNetZar * 0.78
  ) {
    const drop = Math.round((1 - input.revenueNetZar / input.priorRevenueNetZar) * 100);
    alerts.push({
      id: "revenue-drop",
      severity: "CRITICAL",
      title: "Revenue anomaly vs prior month",
      description: `MTD net revenue is ${drop}% below the prior full month run-rate comparison.`,
      offices: ["CFO", "CEO"],
      href: executiveHomePath("CFO"),
      metric: "revenueNetZar",
      currentValue: String(input.revenueNetZar),
    });
  }

  return alerts;
}

export function alertsForOffice(alerts: ExecutiveAlert[], office: ExecutiveOffice): ExecutiveAlert[] {
  return alerts.filter((a) => a.offices.includes(office));
}
