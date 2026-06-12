/** Immersive watch route — no browse chrome padding around the player. */
export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 overflow-hidden">{children}</div>;
}
