import {
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  CreditCard,
  Eye,
  GraduationCap,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  MessageSquareText,
  MonitorPlay,
  QrCode,
  ShieldCheck,
  TrendingUp,
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
      { label: "الخزنة والنظام المالي", to: "/owner/treasury", icon: Wallet },
      { label: "غرفة تحكم الجدولة", to: "/owner/schedule", icon: CalendarCheck },
      { label: "التزام المدرسين", to: "/owner/compliance", icon: ClipboardCheck },
      { label: "كل المهام", to: "/owner/tasks", icon: ListTodo },
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
      { label: "مهامي", to: "/staff/tasks", icon: ListTodo },
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
      { label: "التقييمات والغياب", to: "/teacher/assessments", icon: ClipboardCheck },
      { label: "مهامي", to: "/teacher/tasks", icon: ListTodo },
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
      { label: "الحضور والغياب", to: "/student/attendance", icon: CalendarCheck },
      { label: "الاستقبال", to: "/student/inbox", icon: Inbox },
      { label: "المستويات", to: "/student/levels", icon: TrendingUp },
      { label: "مدرّسيني ومنهجي", to: "/student/teachers", icon: BookMarked },
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

export const ROLE_ORDER: UserRole[] = ["owner", "staff", "teacher", "student", "parent", "visitor"];
