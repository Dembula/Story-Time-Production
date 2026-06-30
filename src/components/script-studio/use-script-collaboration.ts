"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

export type CollaborationPeer = {
  userId: string;
  displayName: string;
  image: string | null;
  color: string;
  mode: "writer" | "producer" | "read_only";
  cursorLine: number;
  cursorCol: number;
  selectionStart: number;
  selectionEnd: number;
  isTyping: boolean;
  isWriting: boolean;
  activeSceneHeading: string | null;
  lastSeen: number;
};

export type ProjectCollaborator = {
  userId: string;
  role: string;
  department: string | null;
  status: string;
  displayName: string;
  image: string | null;
};

type CollaborationState = {
  peers: CollaborationPeer[];
  collaborators: ProjectCollaborator[];
  canWrite: boolean;
  canComment: boolean;
  collaborationMode: "writer" | "producer" | "read_only";
  myColor: string;
  scriptUpdatedAt: string | null;
  remoteRevision: boolean;
  remoteUpdatedBy: string | null;
};

export function useScriptCollaboration(options: {
  scriptId: string | null | undefined;
  enabled: boolean;
  isDirty: boolean;
  onRemoteScript?: (payload: {
    content: string;
    title: string;
    updatedAt: string;
  }) => void;
  getCursor?: () => {
    line: number;
    col: number;
    selectionStart: number;
    selectionEnd: number;
    sceneHeading: string | null;
    isTyping: boolean;
    isWriting: boolean;
  };
}) {
  const { data: session } = useSession();
  const { scriptId, enabled, isDirty, onRemoteScript } = options;
  const getCursorRef = useRef(options.getCursor);
  getCursorRef.current = options.getCursor;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const onRemoteRef = useRef(onRemoteScript);
  onRemoteRef.current = onRemoteScript;

  const [state, setState] = useState<CollaborationState>({
    peers: [],
    collaborators: [],
    canWrite: true,
    canComment: true,
    collaborationMode: "writer",
    myColor: "#f97316",
    scriptUpdatedAt: null,
    remoteRevision: false,
    remoteUpdatedBy: null,
  });

  const lastKnownUpdatedAt = useRef<string | null>(null);
  const modeRef = useRef(state.collaborationMode);
  modeRef.current = state.collaborationMode;

  const pullRemoteScript = useCallback(async () => {
    if (!scriptId) return;
    const res = await fetch(`/api/creator/scripts/${scriptId}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      script: { content: string; title: string; updatedAt: string };
    };
    lastKnownUpdatedAt.current = data.script.updatedAt;
    onRemoteRef.current?.({
      content: data.script.content,
      title: data.script.title,
      updatedAt: data.script.updatedAt,
    });
    setState((prev) => ({
      ...prev,
      scriptUpdatedAt: data.script.updatedAt,
      remoteRevision: false,
      remoteUpdatedBy: null,
    }));
  }, [scriptId]);

  const sendHeartbeat = useCallback(async () => {
    if (!scriptId || !enabled) return;
    const cursor = getCursorRef.current?.() ?? {
      line: 0,
      col: 0,
      selectionStart: 0,
      selectionEnd: 0,
      sceneHeading: null,
      isTyping: false,
      isWriting: false,
    };

    const res = await fetch(`/api/creator/scripts/${scriptId}/collaboration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "heartbeat",
        displayName: session?.user?.name,
        image: session?.user?.image,
        mode: modeRef.current,
        cursorLine: cursor.line,
        cursorCol: cursor.col,
        selectionStart: cursor.selectionStart,
        selectionEnd: cursor.selectionEnd,
        isTyping: cursor.isTyping,
        isWriting: cursor.isWriting,
        activeSceneHeading: cursor.sceneHeading,
      }),
    });

    if (!res.ok) return;
    const data = (await res.json()) as {
      peers?: CollaborationPeer[];
      scriptUpdatedAt?: string;
    };

    const prevUpdated = lastKnownUpdatedAt.current;
    if (data.scriptUpdatedAt) {
      if (prevUpdated && data.scriptUpdatedAt !== prevUpdated && !isDirtyRef.current) {
        const writer = data.peers?.find((p) => p.isWriting || p.isTyping);
        setState((prev) => ({
          ...prev,
          remoteRevision: true,
          remoteUpdatedBy: writer?.displayName ?? "A collaborator",
        }));
        await pullRemoteScript();
      }
      lastKnownUpdatedAt.current = data.scriptUpdatedAt;
    }

    setState((prev) => ({
      ...prev,
      peers: data.peers ?? prev.peers,
    }));
  }, [scriptId, enabled, session?.user?.name, session?.user?.image, pullRemoteScript]);

  const loadCollaborators = useCallback(async () => {
    if (!scriptId || !enabled) return;
    const res = await fetch(`/api/creator/scripts/${scriptId}/collaboration`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      peers: CollaborationPeer[];
      collaborators: ProjectCollaborator[];
      canWrite: boolean;
      collaborationMode: CollaborationState["collaborationMode"];
      myColor: string;
      scriptUpdatedAt: string;
    };
    lastKnownUpdatedAt.current = data.scriptUpdatedAt;
    setState((prev) => ({
      ...prev,
      peers: data.peers,
      collaborators: data.collaborators,
      canWrite: data.canWrite,
      canComment: data.canWrite || data.collaborationMode === "producer",
      collaborationMode: data.collaborationMode,
      myColor: data.myColor,
      scriptUpdatedAt: data.scriptUpdatedAt,
    }));
  }, [scriptId, enabled]);

  useEffect(() => {
    if (!scriptId || !enabled) return;
    void loadCollaborators();
    const interval = window.setInterval(() => {
      void sendHeartbeat();
    }, 2000);
    return () => {
      window.clearInterval(interval);
      void fetch(`/api/creator/scripts/${scriptId}/collaboration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      }).catch(() => {});
    };
  }, [scriptId, enabled, loadCollaborators, sendHeartbeat]);

  const setMode = useCallback((mode: CollaborationState["collaborationMode"]) => {
    modeRef.current = mode;
    setState((prev) => ({
      ...prev,
      collaborationMode: mode,
      canWrite: mode === "writer",
      canComment: mode !== "read_only",
    }));
    void sendHeartbeat();
  }, [sendHeartbeat]);

  const applyRemoteRevision = useCallback(() => {
    void pullRemoteScript();
  }, [pullRemoteScript]);

  const dismissRemoteRevision = useCallback(() => {
    setState((prev) => ({ ...prev, remoteRevision: false }));
  }, []);

  const activeWriters = state.peers.filter((p) => p.isWriting || p.isTyping);

  return {
    ...state,
    activeWriters,
    setMode,
    applyRemoteRevision,
    dismissRemoteRevision,
    refresh: loadCollaborators,
    markSaved: (updatedAt: string) => {
      lastKnownUpdatedAt.current = updatedAt;
      setState((prev) => ({ ...prev, scriptUpdatedAt: updatedAt }));
    },
  };
}
