import { useEffect } from "react";

// Shared keyframes style - injected once per document
const SPINNER_KEYFRAMES = `@keyframes cc-balance-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
const KEYFRAMES_ATTR = "data-cc-spinner-keyframes";

function injectSpinnerKeyframes() {
  if (typeof document === "undefined") return;
  // Check if already injected using a data attribute on the style element
  if (document.querySelector(`style[${KEYFRAMES_ATTR}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(KEYFRAMES_ATTR, "true");
  style.textContent = SPINNER_KEYFRAMES;
  document.head.appendChild(style);
}

export function BalanceSpinner({ size = 12 }: { size?: number }) {
  // Inject keyframes once on first render
  useEffect(() => {
    injectSpinnerKeyframes();
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        animation: "cc-balance-spin 1s linear infinite",
        opacity: 0.6,
      }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}
