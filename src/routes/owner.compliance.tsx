<Panel title="الالتزام حسب مرحلة الحصة" description="نسبة الحصص التي احترمت توقيت المرحلة">
  {!hasRealSessions ? (
    <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
      لا توجد حصص حقيقية مسجَّلة بعد — هذا القسم سيُملأ تلقائياً بعد أول حصة فعلية.
    </p>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SESSION_STEPS.map((step, i) => (
        <div key={step.key} className="rounded-xl border-2 border-border p-4">
          <div className="flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-lg bg-navy text-sm font-black text-navy-foreground">
              {i + 1}
            </span>
            <StatusBadge tone={avg >= 90 ? "success" : avg >= 80 ? "warning" : "destructive"}>
              {formatPercent(avg)}
            </StatusBadge>
          </div>
          <p className="mt-3 font-black text-foreground">{step.title}</p>
          <p className="mt-1 text-xs font-bold text-muted-foreground">
            المدة المعتمدة: {Math.round(step.duration / 60)} دقيقة
          </p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${avg}%` }} />
          </div>
        </div>
      ))}
    </div>
  )}
</Panel>