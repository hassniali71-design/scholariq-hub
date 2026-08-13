import { PdfUploadBox } from "@/components/session/PdfUploadBox";
import { LessonStep } from "@/components/session/SessionSteps";
import type { Lesson, LessonSlide } from "@/types";

interface InteractiveSlideViewerProps {
  /** Latest upload attempt for this group, in any ai_status — drives the upload box. */
  activeLesson: Lesson | null;
  busy: boolean;
  /** Resolved slide deck to present: the latest *ready* lesson's own slides, or the legacy fallback. */
  slides: LessonSlide[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  onFile: (file: File) => void;
  onRetry: () => void;
}

/**
 * §7-د's presenter view: upload box on top (always available, so a teacher can
 * replace the lesson mid-course), the current slide deck underneath. A failed
 * or in-progress upload never blanks out a deck that already worked.
 */
export function InteractiveSlideViewer({
  activeLesson,
  busy,
  slides,
  index,
  onPrev,
  onNext,
  onFile,
  onRetry,
}: InteractiveSlideViewerProps) {
  const failed = activeLesson?.ai_status === "failed" ? { error: activeLesson.ai_error } : null;
  const hasSlidesToShow = !busy && !failed && slides.length > 0;

  if (hasSlidesToShow) {
    return (
      <div className="space-y-4">
        <LessonStep
          slides={slides}
          index={Math.min(index, slides.length - 1)}
          onPrev={onPrev}
          onNext={onNext}
        />
        <PdfUploadBox busy={busy} failed={failed} onFile={onFile} onRetry={onRetry} compact />
      </div>
    );
  }

  return <PdfUploadBox busy={busy} failed={failed} onFile={onFile} onRetry={onRetry} />;
}
