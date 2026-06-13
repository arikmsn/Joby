interface JobyMarkProps {
  className?: string;
  /** "brand" = filled teal square with white mark (default). "mono" = outline only, inherits text color. */
  tone?: "brand" | "mono";
}

/**
 * Joby brand mark — a geometric "J" terminating in a pivot dot,
 * evoking a shift handoff / opportunity signal.
 */
export function JobyMark({ className = "h-6 w-6", tone = "brand" }: JobyMarkProps) {
  if (tone === "mono") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M14.75 5.5V14.25C14.75 16.8734 12.6234 19 10 19C8.78 19 7.62 18.6 6.65 17.9"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#0d9488" />
      <path
        d="M14.75 5.5V14.25C14.75 16.8734 12.6234 19 10 19C8.78 19 7.62 18.6 6.65 17.9"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
