import {
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  CreditCard,
  Eye,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  MessageSquareText,
  MonitorPlay,
  QrCode,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface RoleConfig {
  role: UserRole;
  title: string;
  subtitle: string;
  loginHint: string;
  home: string;
  icon: LucideIcon;
  nav: NavItem[];
}

export const ROLES: Record<UserRole, RoleConfig> = {
  owner: {
    role: "owner",
    title: "المالك / الأدمن",
    subtitle: "برج التحكم والتحليلات المالية",
    loginHint: "بريد إلكتروني + كلمة مرور",
    home: "/owner",
    icon: ShieldCheck,
    nav: [
      { label: "برج التحكم", to: "/owner", icon: LayoutDashboard },
      { label: "التدفق المالي", to: "/owner/finance", icon: BarChart3 },
      { label: "التزام المدرسين", to: "/owner/compliance", icon: CalendarCheck },
      { label: "الطلاب والمجموعات", to: "/owner/students", icon: Users },
      { label: "إدارة وصلاحيات الوصول", to: "/owner/access", icon: KeyRound },
    ],
  },
  staff: {
    role: "staff",
    title: "السكرتارية / الموظفين",
    subtitle: "بوابة الدخول السريع والكاشير",
    loginHint: "كود الموظف (Staff PIN)",
    home: "/staff",
    icon: QrCode,
    nav: [
      { label: "بوابة الحضور", to: "/staff", icon: QrCode },
      { label: "الكاشير", to: "/staff/cashier", icon: CreditCard },
      { label: "مخزون الملازم", to: "/staff/booklets", icon: BookOpen },
      { label: "تقفيل الوردية", to: "/staff/shift", icon: Wallet },
    ],
  },
  teacher: {
    role: "teacher",
    title: "المدرس و الـ TA",
    subtitle: "مركز قيادة الحصة والتايمرات",
    loginHint: "حساب المدرس",
    home: "/teacher",
    icon: MonitorPlay,
    nav: [
      { label: "لوحة المدرس", to: "/teacher", icon: LayoutDashboard },
      // "وضع الحصة" يوجّه للوحة المدرس نفسها لا مباشرة لجلسة — هذا الرابط عام
      // بلا سياق مجموعة محددة (الراوت بقى يحتاج $groupId بعد إصلاح البق).
      // زر "ابدأ" الحقيقي لكل مجموعة موجود في قائمة المجموعات بلوحة المدرس.
      { label: "وضع الحصة", to: "/teacher", icon: MonitorPlay },
      { label: "التقييمات والغياب", to: "/teacher/assessments", icon: ClipboardCheck },
      { label: "الخطة والمنهج", to: "/teacher/curriculum", icon: BookMarked },
    ],
  },
  student: {
    role: "student",
    title: "الطالب",
    subtitle: "لوحة الأداء الشخصية والنقاط",
    loginHint: "كود الطالب (Student ID)",
    home: "/student",
    icon: GraduationCap,
    nav: [
      { label: "لوحتي", to: "/student", icon: LayoutDashboard },
      { label: "لوحة الشرف", to: "/student/leaderboard", icon: Trophy },
    ],
  },
  parent: {
    role: "parent",
    title: "ولي الأمر",
    subtitle: "متابعة لحظية بدون أعذار",
    loginHint: "كود الطالب / مفتاح المتابعة",
    home: "/parent",
    icon: MessageSquareText,
    nav: [
      { label: "متابعة الابن", to: "/parent", icon: LayoutDashboard },
      { label: "سجل الواتساب", to: "/parent/messages", icon: MessageSquareText },
    ],
  },
  visitor: {
    role: "visitor",
    title: "الزائر",
    subtitle: "استعراض عام عن السنتر",
    loginHint: "كود دعوة الزائر",
    home: "/visitor",
    icon: Eye,
    nav: [{ label: "نظرة عامة", to: "/visitor", icon: LayoutDashboard }],
  },
};

export const ROLE_ORDER: UserRole[] = [
  "owner",
  "staff",
  "teacher",
  "student",
  "parent",
  "visitor",
];
