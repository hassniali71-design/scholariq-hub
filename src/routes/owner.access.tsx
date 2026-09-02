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
  addPayroll,
  createStudentRecord,
  deleteStudentCompletely,
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
      { property: "og:title", content: "إدارة وصلاحيات الوصول — لوحة المالك" },
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
  onCreate: (name: string, phone: string) => Promise<CreatedCredentials>;
}

function ProvisionForm({ title, hint, icon: Icon, submitLabel, onCreate }: FormCardProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) {
          toast.error("من فضلك أدخل الاسم ورقم الهاتف");
          return;
        }
        setSubmitting(true);
        try {
          const result = await onCreate(name.trim(), phone.trim());
          setCreated(result);
          setName("");
          setPhone("");
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
        disabled={submitting}
        className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "جارٍ الإنشاء…" : submitLabel}
      </button>

      {created ? <CredentialCard data={created} /> : null}
    </form>
  );
}

/**
 * CURRICULUM_ENGINE_SPEC.md §7: dedicated form, not the generic `ProvisionForm` —
 * a student needs a group (to derive grade/group_name) and subject checkboxes,
 * neither of which fit the shared name+phone shape used for teacher/staff.
 *
 * Fixes a real pre-existing gap found while building this: the old student
 * `ProvisionForm` only created an `auth.ts` login account — no `Student` record
 * in the central store ever got created from the UI, so a freshly-provisioned
 * student's code matched nothing and `resolveCurrentStudent` silently fell back
 * to `students[0]`. This form now creates both, linked by the same code.
 */
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
            يتم توليد كود الطالب (Student ID) تلقائياً
          </p>
        </div>
      </div>

      {/* ١ — اسم الطالب */}
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="اسم الطالب بالكامل"
        className={inputClass}
      />

      {/* ٢ — رقم الهاتف */}
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="رقم الهاتف"
        inputMode="tel"
        className={inputClass}
      />

      {/* ٣ — المرحلة الدراسية */}
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

      {/* ٤ — الصف داخل المرحلة */}
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

      {/* ٥ — المواد المتاحة لهذا الصف (متعدد الاختيار) */}
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

      {/* ٦ — نوع الحساب */}
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

      {/* ٧ — سعر كل مادة لهذا الطالب تحديداً */}
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

/**
 * Same fix as `StudentProvisionForm` above, for teachers: the generic `ProvisionForm`
 * (name + phone only) used to create an `auth.ts` login account with no `Teacher` record
 * behind it, so `resolveCurrentTeacher` had nothing to match the new account against and
 * silently fell back to `teachers[0]`. A teacher needs one more field the generic form
 * doesn't have — which subject they teach — so this is a dedicated form, not a `ProvisionForm`
 * instance, same reasoning as the student one.
 */
function TeacherProvisionForm() {
  const state = useDataStore();
  const { subjects } = state;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [subjectId, setSubjectId] = useState("");
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
        if (!subjectId) {
          toast.error("من فضلك اختر المادة");
          return;
        }
        setSubmitting(true);
        try {
          const credentials = await createTeacher(fullName.trim(), phone.trim());
          const record = createTeacherRecord({
            userId: credentials.identifier,
            fullName: fullName.trim(),
            subjectId,
          });
          if (!record) {
            toast.error("حدث خطأ أثناء إنشاء بيانات المدرس");
            return;
          }
          const salary = Number(salaryValue || 0);
          if (salary > 0) {
            // الراتب يُسجَّل كـ"صادر" حقيقي فوراً فيظهر في التدفق المالي وصافي الربح.
            addPayroll({
              personType: "teacher",
              personId: record.id,
              personName: record.full_name,
              basis: salaryBasis,
              amount: salary,
            });
          }
          setCreated(credentials);
          setFullName("");
          setPhone("");
          setSubjectId("");
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
          <p className="text-xs font-bold text-muted-foreground">يتم توليد كود المدرس وكلمة السر</p>
        </div>
      </div>

      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="اسم المدرس بالكامل"
        className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm font-extrabold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground focus:border-primary"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="رقم الهاتف"
        inputMode="tel"
        className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm font-extrabold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground focus:border-primary"
      />
      <select
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm font-extrabold text-foreground outline-none focus:border-primary"
      >
        <option value="">اختر المادة</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={salaryBasis}
          onChange={(e) => setSalaryBasis(e.target.value as PayrollBasis)}
          className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm font-extrabold text-foreground outline-none focus:border-primary"
        >
          <option value="per_session">راتب بالحصة</option>
          <option value="weekly">راتب أسبوعي</option>
          <option value="monthly">راتب شهري</option>
        </select>
        <input
          value={salaryValue}
          onChange={(e) => setSalaryValue(e.target.value)}
          inputMode="numeric"
          placeholder="قيمة الراتب (ج.م)"
          className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm font-extrabold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground focus:border-primary"
        />
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

/** صف حساب واحد — عرض + تعديل (الاسم / الكود / كلمة السر) + حذف. */
function AccountRow({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(account.full_name);
  const [identifier, setIdentifier] = useState(account.identifier);
  const [password, setPassword] = useState(account.password ?? "");

  const inputClass =
    "w-full rounded-lg border-2 border-border bg-background px-3 py-2 text-base font-extrabold text-foreground outline-none focus:border-primary";

  if (editing) {
    return (
      <tr className="border-t-2 border-border text-base font-extrabold">
        <td className="px-5 py-3">
          <input
            className={inputClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </td>
        <td className="px-5 py-3 text-muted-foreground">{ROLES[account.role].title}</td>
        <td className="px-5 py-3">
          <input
            className={inputClass}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </td>
        <td className="px-5 py-3">
          <input
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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

  return (
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
              onClick={async () => {
                try {
                  await deleteAccount(account.id);
                  if (account.role === "student") {
                    // حذف الطالب يمسح معه كل حركته المالية والحضور حتى لا يظل أثره في التدفق المالي.
                    const student = getData().students.find((s) => s.code === account.identifier);
                    if (student) deleteStudentCompletely(student.id);
                  }
                  toast.success("تم حذف الحساب");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء الحذف");
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border-2 border-destructive/40 px-3 py-1.5 text-sm font-black text-destructive"
            >
              <Trash2 className="size-4" />
              حذف
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

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

/** صلاحيات حقيقية ومحددة لكل موظف — مين يقدر يعمل إيه بالظبط. */
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
