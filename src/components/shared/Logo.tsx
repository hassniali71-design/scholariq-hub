/**
 * شعار "سبّورة" الموحّد — نفس تصميم SabboorahMark الأصلي في TopBar.tsx
 * (سبّورة/لوح خضراء بعلامة صح داخل إطار بيضاوي) مستخرَج هنا كمكوّن SVG واحد
 * قابل لإعادة الاستخدام، بدل تكراره محلياً في كل مكان وبدل أيقونة
 * GraduationCap العامة من lucide في تسجيل الدخول والقائمة الجانبية.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="سبّورة"
    >
      <ellipse
        cx="50"
        cy="46"
        rx="42"
        ry="30"
        transform="rotate(-18 50 46)"
        fill="none"
        stroke="#F7F5FB"
        strokeWidth="8"
      />
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
  );
}
