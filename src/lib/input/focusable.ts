const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-focusable="true"]';

export function isVisibleElement(el: HTMLElement): boolean {
  if (el.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;
  if (parseFloat(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return el.offsetParent !== null || style.position === "fixed";
}

export function isEditableTarget(el: HTMLElement | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

export function getFocusableElements(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisibleElement);
}

export function getSpatialNavRoot(): ParentNode {
  const scoped = document.querySelector("[data-spatial-nav-root]");
  return scoped ?? document;
}

export function activateFocusedElement(): void {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return;
  if (active.tagName === "A" || active.tagName === "BUTTON") {
    active.click();
    return;
  }
  active.click();
}
