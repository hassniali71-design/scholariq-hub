import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Copy, Eye, GraduationCap, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { ROLES } from "@/config/roles";
import {
  createStaff,
  createStudent,
  createTeacher,
  createVisitorInvite,
  deleteAccount,
  getAccounts,
  subscribeAuth,
  type Account,
  type CreatedCredentials,
} from "@/lib/auth";

export const Route = createFileRoute("/owner/access")({
  head: () => ({
    meta: [
      { title: "إدارة وصلاحيات الوصول — لوحة المالك" },
      {
        name: "description",
        content: "إنشاء أكواد الطلاب والمدرسين والموظفين ودعوات الزوار وإدارة صلاحيات الدخول.",
      },
      { property: "og:title", content: "إدارة وصلاحيات الوصول — لوحة المالك" },
      {
        property: "og:description",
        content: "توليد أكواد الدخول للطلاب والمدرسين والموظفين والزوار داخل السنتر.",
      },
    ],
  }),
  component: AccessManagement,
});

function copy(text: string) {
  void navigator.clipboard?.writeText(text);
  toast.success(`تم نسخ: ${text}`);
}

function CredentialCard({ data }: { data: CreatedCredentials }) {
  return (
    <div className="rounded-xl border-2 border-success bg-success/10 p-4">
      <p className="flex items-center gap-2 text-sm font-black text-foreground">
        <BadgeCheck className="size-4 text-success" />
        تم إنشاء الحساب: {data.full_name}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => copy(data.identifier)}
          className="flex items-center gap-2 rounded-lg border-2 border-border bg-background px-3 py-2 font-mono text-sm font-black text-foreground"
        >
          <Copy className="size-4" />
          {data.identifier}
        </button>
        {data.password ? (
          <button
            type="button"
            onClick={() => copy(data.password!)}
            className="flex items-center gap-2 rounded-lg border-2 border-border bg-background px-3 py-2 font-mono text-sm font-black text-foreground"
          >
            <Copy className="size-4" />
            {data.password}
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface FormCardProps {
  title: string;
  hint: string;
  icon: typeof UserPlus;
  submitLabel: string;
  onCreate: (name: string, phone: string) => CreatedCredentials;
}

function ProvisionForm({ title, hint, icon: Icon, submitLabel, onCreate }: FormCardProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [created, setCreated] = useState<CreatedCredentials | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) {
          toast.error("من فضلك أدخل الاسم ورقم الهاتف");
          return;
        }
        const result = onCreate(name.trim(), phone.trim());
        setCreated(result);
        setName("");
        setPhone("");
        toast.success(`تم توليد الكود: ${result.identifier}`);
      }}
      className="card-crisp space-y-3 p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-lg font-black text-foreground">{title}</p>
          <p className="text-xs font-bold text-muted-foreground">{hint}</p>
        </div>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="الاسم بالكامل"
        className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm font-extrabold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground focus:border-primary"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="رقم الهاتف"
        inputMode="tel"
        className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm font-extrabold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground focus:border-primary"
      />
      <button
        type="submit"
        className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90"
      >
        {submitLabel}
      </button>

      {created ? <CredentialCard data={created} /> : null}
    </form>
  );
}

function AccessManagement() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invite, setInvite] = useState<CreatedCredentials | null>(null);

  useEffect(() => {
    setAccounts(getAccounts());
    return subscribeAuth(() => setAccounts(getAccounts()));
  }, []);

  return (
    <AppShell
      role="owner"
      title="إدارة وصلاحيات الوصول"
      description="إنشاء الحسابات وتوليد أكواد الدخول — لا يوجد تسجيل ذاتي للمستخدمين"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <ProvisionForm
          title="إضافة طالب"
          hint="يتم توليد كود الطالب (Student ID) تلقائياً"
          icon={GraduationCap}
          submitLabel="توليد كود الطالب"
          onCreate={createStudent}
        />
        <ProvisionForm
          title="إضافة مدرس"
          hint="يتم توليد كود المدرس وكلمة السر"
          icon={Users}
          submitLabel="توليد بيانات المدرس"
          onCreate={createTeacher}
        />
        <ProvisionForm
          title="إضافة موظف"
          hint="يتم توليد كود الموظف وكلمة السر"
          icon={UserPlus}
          submitLabel="توليد بيانات الموظف"
          onCreate={createStaff}
        />
      </div>

      <div className="card-crisp space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <Eye className="size-5" />
            </span>
            <div>
              <p className="text-lg font-black text-foreground">دعوة زائر</p>
              <p className="text-xs font-bold text-muted-foreground">
                كود مؤقت يعرض بيانات عامة فقط بدون أي بيانات مالية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const result = createVisitorInvite();
              setInvite(result);
              toast.success(`تم توليد كود الدعوة: ${result.identifier}`);
            }}
            className="rounded-xl bg-navy px-5 py-3 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90"
          >
            إنشاء كود دعوة زائر
          </button>
        </div>
        {invite ? <CredentialCard data={invite} /> : null}
      </div>

      <div className="card-crisp overflow-hidden">
        <div className="border-b-2 border-border px-5 py-4">
          <p className="text-lg font-black text-foreground">
            الحسابات المُنشأة ({accounts.length})
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-muted">
              <tr className="text-xs font-black text-muted-foreground">
                <th className="px-5 py-3">الاسم</th>
                <th className="px-5 py-3">الدور</th>
                <th className="px-5 py-3">الكود / البريد</th>
                <th className="px-5 py-3">كلمة السر</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t-2 border-border text-sm font-extrabold">
                  <td className="px-5 py-3 text-foreground">{a.full_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{ROLES[a.role].title}</td>
                  <td className="px-5 py-3 font-mono text-foreground">{a.identifier}</td>
                  <td className="px-5 py-3 font-mono text-muted-foreground">
                    {a.password ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    {a.role === "owner" ? null : (
                      <button
                        type="button"
                        onClick={() => {
                          deleteAccount(a.id);
                          toast.success("تم حذف الحساب");
                        }}
                        className="flex items-center gap-1.5 rounded-lg border-2 border-destructive/40 px-3 py-1.5 text-xs font-black text-destructive"
                      >
                        <Trash2 className="size-4" />
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
