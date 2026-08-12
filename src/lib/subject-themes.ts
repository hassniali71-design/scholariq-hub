export interface SubjectTheme {
  primary: string;
  accent: string;
}

/**
 * Keyed by `Subject.theme_key` (the real values seeded in mock-data.ts) —
 * spec §7-و's example table used illustrative subject names that don't match
 * our actual Subject rows, so this uses the real keys instead.
 *
 * Applied only inside teacher.session.tsx's own presenter header, never on
 * `AppShell.tsx` — that component is shared by every role, and touching it
 * would risk changing the sidebar/header for owner/staff/student/parent too.
 */
export const SUBJECT_THEMES: Record<string, SubjectTheme> = {
  physics: { primary: "#1565C0", accent: "#90CAF9" },
  chemistry: { primary: "#6A1B9A", accent: "#CE93D8" },
  math: { primary: "#EF6C00", accent: "#FFCC80" },
  english: { primary: "#2E7D32", accent: "#A5D6A7" },
  biology: { primary: "#00838F", accent: "#80DEEA" },
};

/** Matches the existing `--navy` token exactly — zero visual change when no theme matches. */
const DEFAULT_THEME: SubjectTheme = { primary: "#1E3A8A", accent: "#93A5D8" };

export function getSubjectTheme(themeKey: string | undefined): SubjectTheme {
  return (themeKey ? SUBJECT_THEMES[themeKey] : undefined) ?? DEFAULT_THEME;
}
