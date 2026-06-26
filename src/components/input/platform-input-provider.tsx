"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { isEditableTarget, getFocusableElements } from "@/lib/input/focusable";
import { startGamepadNavigation } from "@/lib/input/gamepad-navigation";
import { matchesShortcut } from "@/lib/input/keyboard-shortcuts";
import { isOfflineDownloadEnabled } from "@/lib/platform/offline-downloads";
import { mapKeyboardToRemoteAction } from "@/lib/input/remote-keys";
import {
  closeTopOverlay,
  dispatchPlaybackCommand,
  isPlayerScopeActive,
} from "@/lib/input/platform-events";
import { moveSpatialFocus, scrollSpatialRow } from "@/lib/input/spatial-navigation";
import { KeyboardShortcutsPanel } from "./keyboard-shortcuts-panel";

type PlatformInputState = {
  gamepadConnected: boolean;
  shortcutsOpen: boolean;
  openShortcuts: () => void;
  closeShortcuts: () => void;
};

const PlatformInputContext = createContext<PlatformInputState | null>(null);

export function PlatformInputProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { inputMode, deviceClass } = useAdaptiveUi();
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const spatialNavEnabled =
    inputMode === "remote" || gamepadConnected || deviceClass === "tv";

  const handleBack = useCallback(() => {
    if (shortcutsOpen) {
      setShortcutsOpen(false);
      return;
    }
    if (closeTopOverlay()) return;
    if (isPlayerScopeActive()) {
      dispatchPlaybackCommand("exit");
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/browse");
  }, [router, shortcutsOpen]);

  useEffect(() => {
    return startGamepadNavigation({
      onConnectedChange: setGamepadConnected,
      onBack: handleBack,
    });
  }, [handleBack]);

  useEffect(() => {
    document.documentElement.dataset.gamepadConnected = gamepadConnected ? "true" : "false";
  }, [gamepadConnected]);

  useEffect(() => {
    if (deviceClass !== "tv" && inputMode !== "remote") return;
    const timer = window.setTimeout(() => {
      if (document.activeElement === document.body || document.activeElement === null) {
        getFocusableElements()[0]?.focus();
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [deviceClass, inputMode, pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = isEditableTarget(target);
      const playerActive = isPlayerScopeActive();
      const remoteAction = mapKeyboardToRemoteAction(event);

      if (!editing && (matchesShortcut(event, "?") || matchesShortcut(event, "shift+/"))) {
        event.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      if (shortcutsOpen && event.key === "Escape") {
        event.preventDefault();
        setShortcutsOpen(false);
        return;
      }

      if (!editing && !playerActive) {
        if (matchesShortcut(event, "/") && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          router.push("/browse/search");
          return;
        }
        if (matchesShortcut(event, "ctrl+k") || matchesShortcut(event, "meta+k")) {
          event.preventDefault();
          router.push("/browse/search");
          return;
        }
        if (matchesShortcut(event, "h") && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          router.push("/browse");
          return;
        }
        if (matchesShortcut(event, "m") && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          router.push("/browse/my-list");
          return;
        }
        if (isOfflineDownloadEnabled() && matchesShortcut(event, "d") && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          router.push("/browse/downloads");
          return;
        }
      }

      if (playerActive && !editing) {
        const key = event.key.toLowerCase();
        if (key === " " || key === "k") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlaybackCommand("play_pause");
          return;
        }
        if (event.key === "ArrowLeft" || key === "j") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlaybackCommand(event.shiftKey ? "seek_back_large" : "seek_back");
          return;
        }
        if (event.key === "ArrowRight" || key === "l") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlaybackCommand(event.shiftKey ? "seek_forward_large" : "seek_forward");
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlaybackCommand("volume_up");
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlaybackCommand("volume_down");
          return;
        }
        if (key === "f") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlaybackCommand("fullscreen_toggle");
          return;
        }
        if (key === "m") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlaybackCommand("mute_toggle");
          return;
        }
        if (remoteAction === "nav_up") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlaybackCommand("volume_up");
          return;
        }
        if (remoteAction === "nav_down") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlaybackCommand("volume_down");
          return;
        }
        if (remoteAction === "nav_left") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlaybackCommand(event.shiftKey ? "seek_back_large" : "seek_back");
          return;
        }
        if (remoteAction === "nav_right") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlaybackCommand(event.shiftKey ? "seek_forward_large" : "seek_forward");
          return;
        }
        if (
          remoteAction === "play_pause" ||
          remoteAction === "rewind" ||
          remoteAction === "fast_forward" ||
          remoteAction === "stop"
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (remoteAction === "play_pause") dispatchPlaybackCommand("play_pause");
          if (remoteAction === "rewind") {
            dispatchPlaybackCommand(event.shiftKey ? "seek_back_large" : "seek_back");
          }
          if (remoteAction === "fast_forward") {
            dispatchPlaybackCommand(event.shiftKey ? "seek_forward_large" : "seek_forward");
          }
          if (remoteAction === "stop") dispatchPlaybackCommand("exit");
          return;
        }
        if (remoteAction === "back") {
          event.preventDefault();
          event.stopPropagation();
          handleBack();
          return;
        }
      }

      if (remoteAction === "back" && !editing) {
        event.preventDefault();
        handleBack();
        return;
      }

      if (
        remoteAction &&
        ["nav_up", "nav_down", "nav_left", "nav_right"].includes(remoteAction) &&
        !editing &&
        !playerActive
      ) {
        const useSpatial =
          spatialNavEnabled || Boolean(target?.closest('[data-spatial-nav="row"]'));

        if (useSpatial) {
          event.preventDefault();
          if (
            remoteAction === "nav_left" &&
            scrollSpatialRow("left") &&
            inputMode === "mouse" &&
            !spatialNavEnabled
          ) {
            return;
          }
          if (
            remoteAction === "nav_right" &&
            scrollSpatialRow("right") &&
            inputMode === "mouse" &&
            !spatialNavEnabled
          ) {
            return;
          }
          const dir =
            remoteAction === "nav_up"
              ? "up"
              : remoteAction === "nav_down"
                ? "down"
                : remoteAction === "nav_left"
                  ? "left"
                  : "right";
          moveSpatialFocus(dir);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [handleBack, inputMode, pathname, router, shortcutsOpen, spatialNavEnabled]);

  const value = useMemo(
    () => ({
      gamepadConnected,
      shortcutsOpen,
      openShortcuts: () => setShortcutsOpen(true),
      closeShortcuts: () => setShortcutsOpen(false),
    }),
    [gamepadConnected, shortcutsOpen],
  );

  return (
    <PlatformInputContext.Provider value={value}>
      {children}
      <KeyboardShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </PlatformInputContext.Provider>
  );
}

export function usePlatformInput() {
  const ctx = useContext(PlatformInputContext);
  if (!ctx) throw new Error("usePlatformInput must be used inside PlatformInputProvider");
  return ctx;
}
