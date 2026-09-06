# ==========================================
# Scholariq Hub - Update & Run
# ==========================================

$ErrorActionPreference = "Stop"

Set-Location "C:\Users\almnara\Downloads\مشروع السنتر\scholariq-hub"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "      Scholariq Hub - Update & Run" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1) سحب آخر تعديلات من GitHub
Write-Host "[1/3] سحب آخر تعديلات من GitHub..." -ForegroundColor Yellow
git pull --recurse-submodules

if ($LASTEXITCODE -ne 0) {
    throw "❌ فشل git pull"
}

# 2) تحديث الحزم فقط لو package/lock تغير
Write-Host ""
Write-Host "[2/3] تحديث الحزم..." -ForegroundColor Yellow
bun install --frozen-lockfile

if ($LASTEXITCODE -ne 0) {
    throw "❌ فشل bun install"
}

# 3) تشغيل المشروع
Write-Host ""
Write-Host "[3/3] تشغيل المشروع..." -ForegroundColor Green
Write-Host ""
Write-Host "🚀 سيتم تشغيل السيرفر الآن..." -ForegroundColor Green
Write-Host "⚠️ اترك هذه النافذة مفتوحة أثناء العمل." -ForegroundColor DarkYellow
Write-Host ""

bun run dev