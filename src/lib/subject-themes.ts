import { BookOpen, FlaskConical, Globe, Languages, Sigma } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SubjectTheme {
  primary: string;
  accent: string;
  icon: LucideIcon;
}

/**
 * Keyed by `Subject.theme_key` (the real values seeded in mock-data.ts).
 * Colors/icons per DESIGN_ATMOSPHERE_SPEC.md §2 — the doc's own example table
 * used illustrative subject-name keys ("عربي" etc.); this uses the real
 * theme_key slugs instead, same pattern already established in this file.
 *
 * Applied inside teacher.index.tsx's "غرفة المادة" header and
 * teacher.session.tsx's presenter header only — never on `AppShell.tsx`,
 * which is shared by every role.
 */
export const SUBJECT_THEMES: Record<string, SubjectTheme> = {
  arabic: { primary: "#8B2E3F", accent: "#D9A8B1", icon: BookOpen },
  english: { primary: "#12777A", accent: "#8FD3D5", icon: Languages },
  math: { primary: "#5B4B8A", accent: "#C3B8E0", icon: Sigma },
  science: { primary: "#2E7D4F", accent: "#A8D9BC", icon: FlaskConical },
  social: { primary: "#B8792F", accent: "#E8C89A", icon: Globe },
};

/** Matches the existing `--navy` token exactly — zero visual change when no theme matches. */
const DEFAULT_THEME: SubjectTheme = { primary: "#1E3A8A", accent: "#93A5D8", icon: BookOpen };

export function getSubjectTheme(themeKey: string | undefined): SubjectTheme {
  return (themeKey ? SUBJECT_THEMES[themeKey] : undefined) ?? DEFAULT_THEME;
}
