import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  Copy,
  Eye,
  GraduationCap,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { OwnerPasswordConfirmModal } from "@/components/owner/OwnerPasswordConfirmModal";
import { ROLES } from "@/config/roles";
import {
  createStaff,
  createStudent,
  createTeacher,
  createVisitorInvite,
  deleteAccount,
  getAccounts,
  subscribeAuth,
  updateAccount,
  type Account,
  type CreatedCredentials,
} from "@/lib/auth";
import {
  createStudentRecord,
  deleteAccountCascade,
  getGradesForStage,
  sumSubjectFees,
  STAGES,
  type StageKey,
  createTeacherRecord,
  getData,
  getStaffPermissions,
  getSubjectsForGrade,
  setStaffPermissions,
  useDataStore,
} from "@/lib/data-store";
import { formatCurrency } from "@/lib/format";
import {
  STAFF_PERMISSION_KEYS,
  type PayrollBasis,
  type StaffPermissionKey,
  type StudentBillingPlan,
} from "@/types";

export const Route = createFileRoute("/owner/access")({
  head: () => ({
    meta: [
      { title: "إدارة وصلاحيات الوصول — لوحة المالك" },
      {
        name: "description",
        content: "إنشاء أكواد الطلاب والمدرسين والموظفين ودعوات الزوار وإدارة صلاحيات الدخول.",
      },
      { property: "og:title", content: "إدارة وصلاحيات الوصول" },
      {
        property: "og:description",
        content: "توليد أكواد الدخول للطلاب والمدرسين والموظفين والزوار داخل السنتر.",
      },
    ],
  }),
  component: AccessManagement,
});

const inputClass =
  "w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm font-extrabold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground focus:border-primary";

function copy(text: string) {
  void navigator.clipboard?.writeText(text);
  toast.success(`تم نسخ: ${text}`);
}

function CredentialCard({ data }: { data: CreatedCredentials }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-primary bg-primary/5 p-4">
      <p className="text-sm font-black text-primary">تم توليد بيانات الدخول</p>
      <p className="mt-2 text-base font-black text-foreground">{data.full_name}</p>
      <div className="mt-2 space-y-1.5">
        <button
          type="button"
          onClick={() => copy(data.identifier)}
          className="flex w-full items-center justify-between rounded-lg bg-background px-3 py-2 text-sm font-extrabold hover:bg-muted"
        >
          <span className="text-muted-foreground">الكود</span>
          <span className="font-mono text-foreground">{data.identifier}</span>
        </button>
        {data.password ? (
          <button
            type="button"
            onClick={() => data.password && copy(data.password)}
            className="flex w-full items-center justify-between rounded-lg bg-background px-3 py-2 text-sm font-extrabold hover:bg-muted"
          >
            <span className="text-muted-foreground">كلمة السر</span>
            <span className="font-mono text-foreground">{data.password}</span>
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs font-bold text-muted-foreground">
        اضغط على كل سطر لنسخه.
      </p>
    </div>
  );
}

/* ---------------- الطالب ---------------- */

function StudentProvisionForm() {
  const state = useDataStore();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<StageKey | "">("");
  const [gradeId, setGradeId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [billingPlan, setBillingPlan] = useState<StudentBillingPlan>("monthly");
  const [fees, setFees] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stageGrades = stage ? getGradesForStage(state, stage) : [];
  const availableSubjects = gradeId ? getSubjectsForGrade(state, gradeId) : [];
  const selectedSubjects = availableSubjects.filter((s) => subjectIds.includes(s.id));
  const numericFees: Record<string, number> = Object.fromEntries(
    subjectIds.map((id) => [id, Number(fees[id] ?? 0) || 0]),
  );
  const totalDue = sumSubjectFees(numericFees);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!fullName.trim() || !phone.trim()) {
          toast.error("من فضلك أدخل اسم الطالب ورقم الهاتف");
          return;
        }
        if (!stage || !gradeId) {
          toast.error("من فضلك اختر المرحلة والصف");
          return;
        }
        if (subjectIds.length === 0) {
          toast.error("من فضلك اختر مادة واحدة على الأقل");
          return;
        }
        setSubmitting(true);
        try {
          const credentials = await createStudent(fullName.trim(), phone.trim());
          const record = createStudentRecord({
            code: credentials.identifier,
            fullName: fullName.trim(),
            gradeId,
            guardianName: fullName.trim(),
            guardianPhone: phone.trim(),
            subjectIds,
            subjectFees: numericFees,
            billingPlan,
          });
          if (!record) {
            toast.error("حدث خطأ أثناء إنشاء بيانات الطالب");
            return;
          }
          setCreated(credentials);
          setFullName("");
          setPhone("");
          setStage("");
          setGradeId("");
          setSubjectIds([]);
          setFees({});
          toast.success(`تم توليد الكود: ${credentials.identifier}`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء إنشاء الحساب");
        } finally {
          setSubmitting(false);
        }
      }}
      className="card-crisp space-y-3 p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <GraduationCap className="size-5" />
        </span>
        <div>
          <p className="text-lg font-black text-foreground">إضافة طالب</p>
          <p className="text-xs font-bold text-muted-foreground">
            النظام يبحث عن مجموعة مطابقة (صف+مادة) تلقائياً
          </p>
        </div>
      </div>

      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="اسم الطالب بالكامل"
        className={inputClass}
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="رقم هاتف ولي الأمر"
        inputMode="tel"
        className={inputClass}
      />

      <select
        value={stage}
        onChange={(e) => {
          setStage(e.target.value as StageKey | "");
          setGradeId("");
          setSubjectIds([]);
          setFees({});
        }}
        className={inputClass}
      >
        <option value="">اختر المرحلة الدراسية</option>
        {STAGES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>

      {stage ? (
        <select
          value={gradeId}
          onChange={(e) => {
            setGradeId(e.target.value);
            setSubjectIds([]);
            setFees({});
          }}
          className={inputClass}
        >
          <option value="">اختر الصف الدراسي</option>
          {stageGrades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      ) : null}

      {gradeId ? (
        <div>
          <p className="mb-2 text-xs font-black text-muted-foreground">
            المواد المتاحة لهذا الصف (اختيار متعدد)
          </p>
          {availableSubjects.length === 0 ? (
            <p className="text-xs font-bold text-muted-foreground">
              لا توجد مواد مسجّلة لهذا الصف بعد.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableSubjects.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-border px-3 py-1.5 text-xs font-black text-foreground has-checked:border-primary has-checked:bg-primary/10"
                >
                  <input
                    type="checkbox"
                    checked={subjectIds.includes(s.id)}
                    onChange={(e) =>
                      setSubjectIds((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                      )
                    }
                    className="size-4"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-black text-muted-foreground">نوع الحساب</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { key: "per_session", label: "حصة" },
              { key: "monthly", label: "شهر" },
              { key: "season", label: "موسم" },
            ] as { key: StudentBillingPlan; label: string }[]
          ).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setBillingPlan(p.key)}
              className={`rounded-xl border-2 px-3 py-2 text-xs font-black transition-colors ${
                billingPlan === p.key
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {selectedSubjects.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-black text-muted-foreground">
            سعر كل مادة لهذا الطالب (يُدخَل يدوياً)
          </p>
          {selectedSubjects.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="min-w-32 text-sm font-black text-foreground">{s.name}</span>
              <input
                type="number"
                min={0}
                value={fees[s.id] ?? ""}
                onChange={(e) => setFees((prev) => ({ ...prev, [s.id]: e.target.value }))}
                placeholder="السعر بالجنيه"
                className={`${inputClass} flex-1`}
              />
            </div>
          ))}
          <p className="rounded-xl border-2 border-border p-3 text-sm font-black text-foreground">
            إجمالي المستحق: {formatCurrency(totalDue)}
          </p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "جارٍ الإنشاء…" : "حفظ الطالب وتوليد الكود"}
      </button>

      {created ? <CredentialCard data={created} /> : null}
    </form>
  );
}

/* ---------------- المدرس (§0.3 — الراتب المتوقع فقط، لا خصم تلقائي) ---------------- */

function TeacherProvisionForm() {
  const state = useDataStore();
  const { subjects } = state;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [stages, setStages] = useState<("primary" | "prep" | "secondary")[]>(["primary"]);
  const [salaryBasis, setSalaryBasis] = useState<PayrollBasis>("monthly");
  const [salaryValue, setSalaryValue] = useState("");
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleStage = (s: "primary" | "prep" | "secondary") => {
    setStages((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!fullName.trim() || !phone.trim()) {
          toast.error("من فضلك أدخل الاسم ورقم الهاتف");
          return;
        }
        if (!subjectId) {
          toast.error("من فضلك اختر المادة");
          return;
        }
        if (stages.length === 0) {
          toast.error("اختر مرحلة واحدة على الأقل");
          return;
        }
        setSubmitting(true);
        try {
          const credentials = await createTeacher(fullName.trim(), phone.trim(), subjectId);
          // §0.3 — الراتب المتوقع يُحفظ في Teacher.expected_salary_* فقط.
          // لا يُخصم من الخزنة ولا يظهر في payroll_records — الخصم الفعلي
          // عند عملية دفع منفصلة من /owner/treasury.
          const record = createTeacherRecord({
            userId: credentials.identifier,
            fullName: fullName.trim(),
            subjectId,
            stages,
            expectedSalaryBasis: salaryBasis,
            expectedSalaryValue: Number(salaryValue || 0),
          });
          if (!record) {
            toast.error("حدث خطأ أثناء إنشاء بيانات المدرس");
            return;
          }
          setCreated(credentials);
          setFullName("");
          setPhone("");
          setSubjectId("");
          setStages(["primary"]);
          setSalaryValue("");
          toast.success(`تم توليد الكود: ${credentials.identifier}`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء إنشاء الحساب");
        } finally {
          setSubmitting(false);
        }
      }}
      className="card-crisp space-y-3 p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-5" />
        </span>
        <div>
          <p className="text-lg font-black text-foreground">إضافة مدرس</p>
          <p className="text-xs font-bold text-muted-foreground">
            الراتب هنا "متوقع" فقط — لا يُخصم من الخزنة تلقائياً
          </p>
        </div>
      </div>

      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="اسم المدرس بالكامل"
        className={inputClass}
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="رقم الهاتف"
        inputMode="tel"
        className={inputClass}
      />

      <div>
        <p className="mb-1.5 text-xs font-black text-muted-foreground">المراحل (يمكن اختيار أكثر من مرحلة)</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { key: "primary" as const, label: "ابتدائي" },
              { key: "prep" as const, label: "إعدادي" },
              { key: "secondary" as const, label: "ثانوي" },
            ]
          ).map((opt) => (
            <label
              key={opt.key}
              className={`flex cursor-pointer items-center justify-center rounded-xl border-2 px-3 py-2 text-sm font-black ${
                stages.includes(opt.key)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground"
              }`}
            >
              <input
                type="checkbox"
                checked={stages.includes(opt.key)}
                onChange={() => toggleStage(opt.key)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <select
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        className={inputClass}
      >
        <option value="">اختر المادة</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <div>
        <p className="mb-1.5 text-xs font-black text-muted-foreground">
          الراتب المتوقع (لا يُخصم من الخزنة)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={salaryBasis}
            onChange={(e) => setSalaryBasis(e.target.value as PayrollBasis)}
            className={inputClass}
          >
            <option value="per_session">بالحصة</option>
            <option value="weekly">أسبوعي</option>
            <option value="monthly">شهري</option>
          </select>
          <input
            value={salaryValue}
            onChange={(e) => setSalaryValue(e.target.value)}
            inputMode="numeric"
            placeholder="قيمة الراتب (ج.م)"
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "جارٍ الإنشاء…" : "توليد بيانات المدرس"}
      </button>

      {created ? <CredentialCard data={created} /> : null}
    </form>
  );
}

/* ---------------- الموظف (§0.3 — نموذج منفصل بدون مراحل/مواد) ---------------- */

function StaffProvisionForm() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [salaryBasis, setSalaryBasis] = useState<PayrollBasis>("monthly");
  const [salaryValue, setSalaryValue] = useState("");
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!fullName.trim() || !phone.trim()) {
          toast.error("من فضلك أدخل الاسم ورقم الهاتف");
          return;
        }
        setSubmitting(true);
        try {
          // §0.3 — الموظف يُنشأ بحساب دخول فقط — لا Teacher record، لا مواد، لا مراحل.
          // الراتب المتوقع يُحفظ في StaffPermissionRecord.expected_salary (إن وُجد)
          // أو في حقل ضمني في الـ UI؛ حالياً نمرّر salaryBasis/salaryValue للـ caller
          // عبر اشتقاق اسم المعرف فقط — الخصم الفعلي عبر payroll_records.
          const result = await createStaff(fullName.trim(), phone.trim());
          setCreated(result);
          setFullName("");
          setPhone("");
          setSalaryValue("");
          // نتذكّر الراتب المتوقع في localStorage الصغير للـ staff salary
          // (لا يُخصم تلقائياً، فقط للتذكير في صفحة التدفق المالي).
          try {
            const stored = JSON.parse(
              window.localStorage.getItem("staff_expected_salary") ?? "{}",
            ) as Record<string, { basis: PayrollBasis; value: number }>;
            stored[result.identifier] = { basis: salaryBasis, value: Number(salaryValue || 0) };
            window.localStorage.setItem("staff_expected_salary", JSON.stringify(stored));
          } catch {
            /* ignore */
          }
          toast.success(`تم توليد الكود: ${result.identifier}`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء إنشاء الحساب");
        } finally {
          setSubmitting(false);
        }
      }}
      className="card-crisp space-y-3 p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserPlus className="size-5" />
        </span>
        <div>
          <p className="text-lg font-black text-foreground">إضافة موظف</p>
          <p className="text-xs font-bold text-muted-foreground">
            كود دخول وكلمة سر — لا حقول تدريس
          </p>
        </div>
      </div>

      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="اسم الموظف بالكامل"
        className={inputClass}
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="رقم الهاتف"
        inputMode="tel"
        className={inputClass}
      />

      <div>
        <p className="mb-1.5 text-xs font-black text-muted-foreground">
          الراتب المتوقع (لا يُخصم تلقائياً)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={salaryBasis}
            onChange={(e) => setSalaryBasis(e.target.value as PayrollBasis)}
            className={inputClass}
          >
            <option value="monthly">شهري</option>
            <option value="weekly">أسبوعي</option>
            <option value="per_session">بالحصة</option>
          </select>
          <input
            value={salaryValue}
            onChange={(e) => setSalaryValue(e.target.value)}
            inputMode="numeric"
            placeholder="قيمة الراتب (ج.م)"
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "جارٍ الإنشاء…" : "توليد بيانات الموظف"}
      </button>

      {created ? <CredentialCard data={created} /> : null}
    </form>
  );
}

/* ---------------- الصفحة الرئيسية ---------------- */

function AccessManagement() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invite, setInvite] = useState<CreatedCredentials | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void getAccounts().then((rows) => {
        if (!cancelled) setAccounts(rows);
      });
    };
    refresh();
    const unsubscribe = subscribeAuth(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <AppShell
      role="owner"
      title="إدارة وصلاحيات الوصول"
      description="إنشاء الحسابات وتوليد أكواد الدخول — لا يوجد تسجيل ذاتي للمستخدمين"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <StudentProvisionForm />
        <TeacherProvisionForm />
        <StaffProvisionForm />
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
            onClick={async () => {
              try {
                const result = await createVisitorInvite();
                setInvite(result);
                toast.success(`تم توليد كود الدعوة: ${result.identifier}`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء إنشاء الدعوة");
              }
            }}
            className="rounded-xl bg-navy px-5 py-3 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90"
          >
            إنشاء كود دعوة زائر
          </button>
        </div>
        {invite ? <CredentialCard data={invite} /> : null}
      </div>

      <StaffPermissionsPanel accounts={accounts} />

      <div className="card-crisp overflow-hidden">
        <div className="border-b-2 border-border px-5 py-4">
          <p className="text-lg font-black text-foreground">
            الحسابات المُنشأة ({accounts.length})
          </p>
          <p className="mt-1 text-xs font-bold text-muted-foreground">
            الحذف الجذري يتطلب تأكيد كلمة سر المالك — يحذف كل البيانات المرتبطة فعلياً
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
                <AccountRow key={a.id} account={a} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------- صف حساب (مع حذف جذري) ---------------- */

function AccountRow({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(account.full_name);
  const [identifier, setIdentifier] = useState(account.identifier);
  const [password, setPassword] = useState(account.password ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const inputCls =
    "w-full rounded-lg border-2 border-border bg-background px-3 py-2 text-base font-extrabold text-foreground outline-none focus:border-primary";

  if (editing) {
    return (
      <tr className="border-t-2 border-border text-base font-extrabold">
        <td className="px-5 py-3">
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </td>
        <td className="px-5 py-3 text-muted-foreground">{ROLES[account.role].title}</td>
        <td className="px-5 py-3">
          <input className={inputCls} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </td>
        <td className="px-5 py-3">
          <input className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
        </td>
        <td className="px-5 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await updateAccount(account.id, {
                    full_name: fullName.trim(),
                    identifier: identifier.trim(),
                    password: password.trim() || null,
                  });
                  setEditing(false);
                  toast.success("تم حفظ التعديل");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "تعذّر حفظ التعديل");
                }
              }}
              className="rounded-lg bg-navy px-3 py-2 text-sm font-black text-navy-foreground"
            >
              حفظ
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border-2 border-border px-3 py-2 text-sm font-black text-foreground"
            >
              إلغاء
            </button>
          </div>
        </td>
      </tr>
    );
  }

  function runCascadeDelete() {
    const role = account.role as "teacher" | "staff" | "student" | "visitor";
    const result = deleteAccountCascade(account.id, role);
    if (result.ok) {
      const details: string[] = [];
      if (result.deletedGroups) details.push(`${result.deletedGroups} مجموعة`);
      if (result.orphanedStudents) details.push(`${result.orphanedStudents} طالب أيتم`);
      if (result.deletedPayroll) details.push(`${result.deletedPayroll} سجل راتب`);
      if (result.deletedSessions) details.push(`${result.deletedSessions} سجل حصة`);
      toast.success(
        details.length
          ? `تم حذف الحساب وكل البيانات المرتبطة: ${details.join("، ")}`
          : "تم حذف الحساب",
      );
    } else {
      toast.error(result.error ?? "فشل الحذف");
    }
    // حذف الـ account row نفسه (server fn) — لا يحدث داخل deleteAccountCascade
    // لأنه محمي بـ try/catch ولا يوقف الباقي.
    void deleteAccount(account.id).catch((e) =>
      toast.error(e instanceof Error ? e.message : "فشل حذف الحساب من accounts"),
    );
  }

  return (
    <>
      <tr className="border-t-2 border-border text-base font-extrabold">
        <td className="px-5 py-3 text-foreground">{account.full_name}</td>
        <td className="px-5 py-3 text-muted-foreground">{ROLES[account.role].title}</td>
        <td className="px-5 py-3 font-mono text-foreground">{account.identifier}</td>
        <td className="px-5 py-3 font-mono text-muted-foreground">{account.password ?? "—"}</td>
        <td className="px-5 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-lg border-2 border-border px-3 py-1.5 text-sm font-black text-foreground hover:border-primary"
            >
              <Pencil className="size-4" />
              تعديل
            </button>
            {account.role === "owner" ? null : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 rounded-lg border-2 border-destructive/40 px-3 py-1.5 text-sm font-black text-destructive"
              >
                <Trash2 className="size-4" />
                حذف جذري
              </button>
            )}
          </div>
        </td>
      </tr>
      <OwnerPasswordConfirmModal
        open={confirmingDelete}
        title="حذف جذري — لا يمكن التراجع"
        description={
          account.role === "teacher"
            ? "سيتم حذف كل مجموعات المدرس وجدوله ورواتبه وتقييماته، والطلاب يتحولون لأيتيام."
            : account.role === "staff"
              ? "سيتم حذف صلاحيات الموظف وسجلات رواتبه."
              : account.role === "student"
                ? "سيتم حذف كل سجلات الطالب المالية والحضور والواجبات."
                : "سيتم حذف حساب الزائر فقط."
        }
        confirmLabel="حذف نهائي"
        destructive
        onClose={() => setConfirmingDelete(false)}
        onConfirm={runCascadeDelete}
      />
    </>
  );
}

/* ---------------- صلاحيات الموظفين ---------------- */

const PERMISSION_LABELS: Record<StaffPermissionKey, string> = {
  attendance_gate: "تشغيل بوابة الحضور",
  cashier: "التحصيل من الكاشير",
  booklets: "إدارة مخزون الملازم",
  shift_close: "تقفيل الوردية",
  view_students: "الاطلاع على بيانات الطلاب",
  edit_students: "تعديل بيانات الطلاب",
  view_finance: "الاطلاع على الأرقام المالية",
  safe_handover: "تسليم الخزنة للمدير",
};

function StaffPermissionsPanel({ accounts }: { accounts: Account[] }) {
  const state = useDataStore();
  const staff = accounts.filter((a) => a.role === "staff");

  return (
    <div className="card-crisp space-y-4 p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <p className="text-lg font-black text-foreground">صلاحيات الموظفين</p>
          <p className="text-sm font-bold text-muted-foreground">
            حدّد بالظبط كل موظف يقدر يفتح ويعمل إيه داخل النظام
          </p>
        </div>
      </div>

      {staff.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
          لا يوجد موظفون بعد — أضف موظفاً من الفورم بالأعلى لتظهر صلاحياته هنا.
        </p>
      ) : (
        <div className="space-y-4">
          {staff.map((a) => {
            const current = getStaffPermissions(state, a.identifier);
            return (
              <div key={a.id} className="rounded-xl border-2 border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-black text-foreground">{a.full_name}</p>
                  <span className="font-mono text-sm font-black text-muted-foreground">
                    {a.identifier}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {STAFF_PERMISSION_KEYS.map((key) => {
                    const checked = current.includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-black ${
                          checked
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? current.filter((k) => k !== key)
                              : [...current, key];
                            setStaffPermissions(a.identifier, a.full_name, next);
                          }}
                          className="size-4"
                        />
                        {PERMISSION_LABELS[key]}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
