import type { SpatialDirection } from "./spatial-navigation";
import { activateFocusedElement, getFocusableElements } from "./focusable";
import { moveSpatialFocus } from "./spatial-navigation";
import {
  dispatchPlaybackCommand,
  isPlayerScopeActive,
} from "./platform-events";

const GP = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  L1: 4,
  R1: 5,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

const STICK_DEADZONE = 0.52;
const STICK_REPEAT_MS = 220;

type GamepadCallbacks = {
  onConnectedChange: (connected: boolean) => void;
  onBack: () => void;
};

export function startGamepadNavigation(callbacks: GamepadCallbacks): () => void {
  if (typeof window === "undefined" || !navigator.getGamepads) {
    return () => {};
  }

  const prevButtons: boolean[] = [];
  let lastStickNavAt = 0;
  let raf = 0;
  let connected = false;

  const activePad = (): Gamepad | null => {
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (pad?.connected) return pad;
    }
    return null;
  };

  const pressEdge = (pad: Gamepad, index: number): boolean => {
    const pressed = Boolean(pad.buttons[index]?.pressed);
    const was = prevButtons[index] ?? false;
    prevButtons[index] = pressed;
    return pressed && !was;
  };

  const stickDirection = (pad: Gamepad): SpatialDirection | null => {
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    if (Math.abs(ax) < STICK_DEADZONE && Math.abs(ay) < STICK_DEADZONE) return null;
    if (Math.abs(ax) > Math.abs(ay)) return ax < 0 ? "left" : "right";
    return ay < 0 ? "up" : "down";
  };

  const tick = () => {
    const pad = activePad();
    const now = Date.now();

    if (!pad) {
      if (connected) {
        connected = false;
        callbacks.onConnectedChange(false);
      }
      raf = requestAnimationFrame(tick);
      return;
    }

    if (!connected) {
      connected = true;
      callbacks.onConnectedChange(true);
      if (!isPlayerScopeActive() && (!document.activeElement || document.activeElement === document.body)) {
        const first = getFocusableElements()[0];
        first?.focus();
      }
    }

    if (isPlayerScopeActive()) {
      if (pressEdge(pad, GP.LEFT)) dispatchPlaybackCommand("seek_back");
      if (pressEdge(pad, GP.RIGHT)) dispatchPlaybackCommand("seek_forward");
      if (pressEdge(pad, GP.UP)) dispatchPlaybackCommand("volume_up");
      if (pressEdge(pad, GP.DOWN)) dispatchPlaybackCommand("volume_down");
      if (pressEdge(pad, GP.A)) dispatchPlaybackCommand("play_pause");
      if (pressEdge(pad, GP.B)) callbacks.onBack();
      if (pressEdge(pad, GP.X) || pressEdge(pad, GP.Y)) dispatchPlaybackCommand("mute_toggle");
      if (pressEdge(pad, GP.L1)) dispatchPlaybackCommand("seek_back_large");
      if (pressEdge(pad, GP.R1)) dispatchPlaybackCommand("seek_forward_large");
      raf = requestAnimationFrame(tick);
      return;
    }

    const dirs: { btn: number; dir: SpatialDirection }[] = [
      { btn: GP.UP, dir: "up" },
      { btn: GP.DOWN, dir: "down" },
      { btn: GP.LEFT, dir: "left" },
      { btn: GP.RIGHT, dir: "right" },
    ];

    for (const { btn, dir } of dirs) {
      if (pressEdge(pad, btn)) moveSpatialFocus(dir);
    }

    const stickDir = stickDirection(pad);
    if (stickDir && now - lastStickNavAt > STICK_REPEAT_MS) {
      moveSpatialFocus(stickDir);
      lastStickNavAt = now;
    }

    if (pressEdge(pad, GP.A)) {
      if (isPlayerScopeActive()) dispatchPlaybackCommand("play_pause");
      else activateFocusedElement();
    }

    if (pressEdge(pad, GP.B)) {
      callbacks.onBack();
    }

    raf = requestAnimationFrame(tick);
  };

  const onConnect = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener("gamepadconnected", onConnect);
  window.addEventListener("gamepaddisconnected", onConnect);
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("gamepadconnected", onConnect);
    window.removeEventListener("gamepaddisconnected", onConnect);
    if (connected) callbacks.onConnectedChange(false);
  };
}
