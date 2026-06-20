/**
 * Minimal inline-SVG icon set. The Terminal 3 brand system is clean and
 * geometric and forbids decorative emoji in the UI, so every glyph here is a
 * thin `currentColor` stroke that inherits the surrounding text colour.
 */
type IconProps = { className?: string };

function svg(path: React.ReactNode, viewBox = "0 0 24 24") {
  return function Icon({ className }: IconProps) {
    return (
      <svg
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className ?? "h-4 w-4"}
      >
        {path}
      </svg>
    );
  };
}

export const CheckIcon = svg(<path d="M20 6 9 17l-5-5" />);
export const XIcon = svg(<path d="M18 6 6 18M6 6l12 12" />);
export const ShieldCheckIcon = svg(
  <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </>,
);
export const WarnIcon = svg(
  <>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </>,
);
export const PlayIcon = svg(<path d="M6 4.5v15l13-7.5-13-7.5Z" />);
export const EyeIcon = svg(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const BankIcon = svg(
  <>
    <path d="M3 10 12 4l9 6" />
    <path d="M4 10v8M9 10v8M15 10v8M20 10v8M2 21h20" />
  </>,
);
export const LockIcon = svg(
  <>
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </>,
);
export const PenIcon = svg(<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />);
export const ArrowRightIcon = svg(<path d="M5 12h14M13 6l6 6-6 6" />);
export const SpinnerIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={`${className ?? "h-4 w-4"} animate-spin`}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
