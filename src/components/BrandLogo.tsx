/**
 * "سبّورة" — the project's own logo, not a role/tenant identity element (separate from
 * AppShell's center name/accent_color and from the 5 subject colors — those are untouched).
 * Fixed-positioned so it lands at the screen's true physical top-left regardless of RTL flex
 * ordering, sidebar presence on desktop, or its absence on mobile — the one placement that
 * doesn't depend on reasoning through RTL layout direction at all.
 */
export function BrandLogo() {
  return (
    <div
      className="fixed left-3 top-3 z-50 flex items-center justify-center rounded-xl bg-white/90 p-1 shadow-md backdrop-blur"
      aria-hidden="true"
    >
      <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <ellipse
          cx="50"
          cy="46"
          rx="42"
          ry="30"
          transform="rotate(-18 50 46)"
          fill="none"
          stroke="#4A2C82"
          strokeWidth="7"
        />
        <ellipse
          cx="50"
          cy="46"
          rx="42"
          ry="30"
          transform="rotate(-18 50 46)"
          fill="none"
          stroke="#C9A227"
          strokeWidth="7"
          strokeDasharray="40 220"
          strokeLinecap="round"
        />
        <path d="M35 78 L28 92 L38 92 Z" fill="#C9A227" />
        <path d="M65 78 L72 92 L62 92 Z" fill="#C9A227" />
        <rect x="24" y="24" width="52" height="40" rx="6" fill="#2E5339" />
        <path
          d="M36 44 L47 55 L65 33"
          fill="none"
          stroke="#F7F5FB"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
