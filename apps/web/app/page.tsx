export default function Home() {
  return (
    <main className="p-6">
      <h1 className="text-title">Lomi-Test</h1>
      <p className="text-body text-ink-2">
        Scaffold placeholder. Screens land from Phase 4 onward.
      </p>

      {/* Design-system probe: T-006 asserts these compute to the DESIGN.md tokens. */}
      <div id="probe-brand" className="bg-brand text-on-brand rounded-control mt-6 p-4">
        bg-brand
      </div>
      <div id="probe-correct" className="bg-correct-soft text-correct rounded-card mt-2 p-4">
        correct
      </div>
      <button id="probe-btn" type="button" className="btn-primary mt-4">
        Primary button
      </button>
      <p id="probe-num" className="num mt-2">
        1:12 / 2:00
      </p>
    </main>
  );
}
