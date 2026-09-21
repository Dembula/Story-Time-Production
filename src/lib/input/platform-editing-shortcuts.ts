/**
 * Platform-wide text editing shortcuts for inputs, textareas, and contenteditable.
 * Restores undo/redo for React-controlled fields (browser undo stack is wiped by
 * controlled `value` updates) and ensures copy/cut/paste/select-all work in-app.
 *
 * Script Writer is excluded — it owns its own history stack.
 */

const SCRIPT_WRITER_EXCLUDE =
  ".script-writer-root, .script-writer-editor-root, .script-writer-page, [data-script-writer]";

const HISTORY_MAX = 80;

type FieldSnapshot = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

type FieldHistory = {
  undo: FieldSnapshot[];
  redo: FieldSnapshot[];
  lastValue: string;
  suppress: boolean;
};

const historyByEl = new WeakMap<HTMLElement, FieldHistory>();

function isScriptWriterContext(el: HTMLElement | null): boolean {
  return Boolean(el?.closest(SCRIPT_WRITER_EXCLUDE));
}

export function isTextEditingTarget(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (isScriptWriterContext(el)) return false;
  const tag = el.tagName;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type?.toLowerCase() || "text";
    if (
      [
        "button",
        "checkbox",
        "radio",
        "file",
        "submit",
        "reset",
        "image",
        "range",
        "color",
        "hidden",
      ].includes(type)
    ) {
      return false;
    }
    return true;
  }
  if (tag === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("[contenteditable='true']"));
}

function resolveEditableElement(el: HTMLElement): HTMLElement | null {
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return el;
  if (el.isContentEditable) return el;
  return el.closest("[contenteditable='true']") as HTMLElement | null;
}

function readSnapshot(el: HTMLElement): FieldSnapshot | null {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return {
      value: el.value,
      selectionStart: el.selectionStart ?? el.value.length,
      selectionEnd: el.selectionEnd ?? el.value.length,
    };
  }
  if (el.isContentEditable) {
    const value = el.innerText ?? "";
    const sel = window.getSelection();
    let selectionStart = value.length;
    let selectionEnd = value.length;
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      try {
        const range = sel.getRangeAt(0);
        const pre = range.cloneRange();
        pre.selectNodeContents(el);
        pre.setEnd(range.startContainer, range.startOffset);
        selectionStart = pre.toString().length;
        selectionEnd = selectionStart + range.toString().length;
      } catch {
        /* ignore */
      }
    }
    return { value, selectionStart, selectionEnd };
  }
  return null;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc?.set) desc.set.call(el, value);
  else el.value = value;
}

function applySnapshot(el: HTMLElement, snap: FieldSnapshot) {
  const hist = historyByEl.get(el);
  if (hist) hist.suppress = true;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    setNativeValue(el, snap.value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    try {
      el.setSelectionRange(snap.selectionStart, snap.selectionEnd);
    } catch {
      /* some input types reject selection */
    }
  } else if (el.isContentEditable) {
    el.innerText = snap.value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    try {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch {
      /* ignore */
    }
  }

  if (hist) {
    hist.lastValue = snap.value;
    void Promise.resolve().then(() => {
      hist.suppress = false;
    });
  }
}

function ensureHistory(el: HTMLElement): FieldHistory {
  let hist = historyByEl.get(el);
  if (!hist) {
    const snap = readSnapshot(el);
    hist = {
      undo: [],
      redo: [],
      lastValue: snap?.value ?? "",
      suppress: false,
    };
    historyByEl.set(el, hist);
  }
  return hist;
}

function pushHistory(el: HTMLElement) {
  const hist = ensureHistory(el);
  if (hist.suppress) return;
  const snap = readSnapshot(el);
  if (!snap) return;
  if (snap.value === hist.lastValue) return;
  hist.undo.push({
    value: hist.lastValue,
    selectionStart: snap.selectionStart,
    selectionEnd: snap.selectionEnd,
  });
  if (hist.undo.length > HISTORY_MAX) hist.undo.shift();
  hist.redo = [];
  hist.lastValue = snap.value;
}

function undoField(el: HTMLElement): boolean {
  const hist = ensureHistory(el);
  if (hist.undo.length === 0) {
    if (el.isContentEditable && document.queryCommandSupported?.("undo")) {
      return document.execCommand("undo");
    }
    return false;
  }
  const current = readSnapshot(el);
  const prev = hist.undo.pop()!;
  if (current) hist.redo.push(current);
  applySnapshot(el, prev);
  return true;
}

function redoField(el: HTMLElement): boolean {
  const hist = ensureHistory(el);
  if (hist.redo.length === 0) {
    if (el.isContentEditable && document.queryCommandSupported?.("redo")) {
      return document.execCommand("redo");
    }
    return false;
  }
  const current = readSnapshot(el);
  const next = hist.redo.pop()!;
  if (current) hist.undo.push(current);
  applySnapshot(el, next);
  return true;
}

function pastePlainText(el: HTMLElement, text: string): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    pushHistory(el);
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    setNativeValue(el, next);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    const caret = start + text.length;
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      /* ignore */
    }
    ensureHistory(el).lastValue = next;
    return true;
  }
  if (el.isContentEditable) {
    pushHistory(el);
    const ok = document.execCommand("insertText", false, text);
    const snap = readSnapshot(el);
    if (snap) ensureHistory(el).lastValue = snap.value;
    return ok;
  }
  return false;
}

function selectAll(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus();
    el.select();
    return true;
  }
  if (el.isContentEditable) {
    const sel = window.getSelection();
    if (!sel) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }
  return false;
}

function isMod(e: KeyboardEvent) {
  return e.metaKey || e.ctrlKey;
}

/**
 * Install document-level listeners. Returns cleanup.
 * Safe to call once from PlatformInputProvider.
 */
export function startPlatformEditingShortcuts(): () => void {
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target;
    if (!isTextEditingTarget(target)) return;
    const el = resolveEditableElement(target);
    if (!el || isScriptWriterContext(el)) return;
    const snap = readSnapshot(el);
    const hist = ensureHistory(el);
    if (snap && hist.undo.length === 0) {
      hist.lastValue = snap.value;
    }
  };

  const onInput = (event: Event) => {
    const target = event.target;
    if (!isTextEditingTarget(target)) return;
    const el = resolveEditableElement(target);
    if (!el || isScriptWriterContext(el)) return;
    pushHistory(el);
  };

  const onPaste = (event: ClipboardEvent) => {
    const target = event.target;
    if (!isTextEditingTarget(target)) return;
    const el = resolveEditableElement(target);
    if (!el || isScriptWriterContext(el)) return;
    // Keep plain text in contenteditable tool surfaces (avoid HTML dumps).
    if (!el.isContentEditable) return;
    const text = event.clipboardData?.getData("text/plain");
    if (text == null) return;
    event.preventDefault();
    event.stopPropagation();
    pastePlainText(el, text);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (!isTextEditingTarget(target)) return;
    const el = resolveEditableElement(target);
    if (!el || isScriptWriterContext(el)) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (el.readOnly || el.disabled) return;
    }

    if (!isMod(event) || event.altKey) return;

    const key = event.key.toLowerCase();

    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      undoField(el);
      return;
    }

    if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      redoField(el);
      return;
    }

    if (key === "a") {
      event.preventDefault();
      event.stopPropagation();
      selectAll(el);
    }

    // Copy / cut / paste on inputs & textareas: leave to the browser.
    // Contenteditable paste is handled in the paste listener (plain text).
  };

  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("paste", onPaste, true);
  document.addEventListener("keydown", onKeyDown, true);

  return () => {
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("paste", onPaste, true);
    document.removeEventListener("keydown", onKeyDown, true);
  };
}
