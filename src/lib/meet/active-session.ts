export type ActiveMeetSession = {
  meetingId: string;
  title: string;
  code: string;
  displayName: string;
};

type Snapshot = {
  call: ActiveMeetSession | null;
  minimized: boolean;
};

let snapshot: Snapshot = { call: null, minimized: false };
const listeners = new Set<() => void>();

export function getActiveMeetSnapshot(): Snapshot {
  return snapshot;
}

export function setActiveMeetSnapshot(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

export function subscribeActiveMeet(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
