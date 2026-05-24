import { useEffect, useRef, useState } from "react";

const LS_KEY = "retire-plan:welcome-dismissed";

export function shouldAutoShowWelcome(): boolean {
  try {
    return localStorage.getItem(LS_KEY) !== "1";
  } catch {
    return true;
  }
}

export function Welcome({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dontShow, setDontShow] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function finish() {
    if (dontShow) {
      try {
        localStorage.setItem(LS_KEY, "1");
      } catch {
        /* private mode etc. — silently no-op */
      }
    }
    onClose();
  }

  return (
    <div
      className="welcome-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) finish();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="welcome-card">
        <button
          ref={closeBtnRef}
          onClick={finish}
          className="welcome-close"
          aria-label="Close"
          type="button"
        >
          ×
        </button>

        <h2 id="welcome-title">How Money Runway works</h2>
        <p className="welcome-sub">A 30-second tour of the math.</p>

        <div className="flow">
          <div className="flow-row">
            <span className="flow-box income">💼 Salary</span>
            <span className="flow-arrow">→</span>
            <span className="flow-box expense">🛒 Expenses + 🏠 Loan</span>
          </div>
          <div className="flow-split-line" />
          <div className="flow-row split">
            <div className="flow-col">
              <div className="flow-label good">✅ Surplus → save</div>
              <div className="flow-box save">
                EPF (cap RM100k) <br />
                → ASM → Stocks → Cash
              </div>
            </div>
            <div className="flow-col">
              <div className="flow-label bad">❌ Shortfall → drain</div>
              <div className="flow-box drain">
                Cash → Stocks <br />
                → ASM → EPF
              </div>
            </div>
          </div>
          <div className="flow-footer">
            Year after year → <b>📈 Asset trajectory chart</b> shows your runway
          </div>
        </div>

        <div className="welcome-steps">
          <h3>To use this app:</h3>
          <ol>
            <li>
              <b>Pick a profile</b> (or skip and edit freely)
            </li>
            <li>
              Tweak the <b>Settings</b>, <b>Your money</b>, <b>Your life</b> sections
            </li>
            <li>
              Watch the <b>Results</b> panel update live
            </li>
          </ol>
        </div>

        <p className="welcome-privacy">🔒 Your data never leaves this browser.</p>

        <div className="welcome-actions">
          <label className="welcome-dont-show">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
            />
            Don&apos;t show this again
          </label>
          <button onClick={finish} className="welcome-primary" type="button">
            Got it, let&apos;s plan!
          </button>
        </div>
      </div>
    </div>
  );
}
