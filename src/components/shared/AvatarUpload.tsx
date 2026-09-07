import { Camera } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { toast } from "sonner";

const MAX_AVATAR_BYTES = 1_500_000;

/**
 * عرض صورة بروفايل دائرية بحجم قابل للتخصيص — بدون رفع، للاستخدام في أي مكان
 * نعرض فيه صورة طالب/مدرس محفوظة مسبقاً (القائمة الجانبية، بطاقة مدرّس للطالب...).
 */
export function AvatarCircle({
  src,
  alt,
  sizeClass = "size-16",
  fallback,
}: {
  src?: string | null | undefined;
  alt: string;
  sizeClass?: string;
  fallback?: ReactNode;
}) {
  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-muted`}
    >
      {src ? (
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        (fallback ?? <span className="text-2xl font-black text-muted-foreground">👤</span>)
      )}
    </div>
  );
}

/**
 * نفس منطق رفع صورة بروفايل الطالب الأصلي (Migration 0028) — عُمِّم هنا ليُستخدم
 * لأي كيان (طالب أو مدرس) عبر `onUpload`، بدل تكرار نفس الكود في كل صفحة.
 */
export function AvatarUpload({
  imageData,
  alt,
  sizeClass = "size-16",
  onUpload,
}: {
  imageData?: string | null | undefined;
  alt: string;
  sizeClass?: string;
  onUpload: (dataUrl: string, mime: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("اختر ملف صورة فقط");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("حجم الصورة كبير — اختر صورة أصغر من 1.5 ميجا");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      onUpload(dataUrl, file.type);
      toast.success("تم تحديث صورة البروفايل");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="relative shrink-0">
      <AvatarCircle src={imageData} alt={alt} sizeClass={sizeClass} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute -bottom-1.5 -left-1.5 flex size-6 items-center justify-center rounded-full border-2 border-background bg-navy text-navy-foreground"
        aria-label="تغيير صورة البروفايل"
      >
        <Camera className="size-3.5" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
