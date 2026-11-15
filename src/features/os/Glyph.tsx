import type { AppId } from "./os-types";

// One line-drawn glyph per app, on a 24px grid, drawn in currentColor.
const PATHS: Record<AppId | "home", React.ReactNode> = {
  career: (<><path d="M4 19V5" /><circle cx="4" cy="7" r="1.6" /><path d="M4 12h6l3-4h7" /><circle cx="20" cy="8" r="1.6" /><path d="M10 12l3 5h7" /><circle cx="20" cy="17" r="1.6" /></>),
  projects: (<><ellipse cx="12" cy="6" rx="7" ry="2.6" /><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" /><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" /></>),
  stack: (<><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="7" r="2.2" /><circle cx="12" cy="18" r="2.2" /><path d="M8 7l8 0M7 8l4 8M17 9l-4 7" /></>),
  log: (<><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 11h7M9 14h7M9 17h4" /></>),
  founder: (<><path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z" /></>),
  terminal: (<><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M7 10l3 2-3 2M12 15h5" /></>),
  home: (<><rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></>),
};

export const Glyph = ({ app, size = 20 }: { app: AppId | "home"; size?: number }) => (
  <svg className="glyph" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {PATHS[app]}
  </svg>
);
