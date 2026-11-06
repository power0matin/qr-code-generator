# ModuQR — راهنمای فارسی

ابزار ModuQR یک استودیوی متن‌باز برای ساخت، طراحی و اسکن QR است که دو اصل را جدی می‌گیرد: **حفظ قابلیت اسکن** و **حریم خصوصی در حالت Static**.

## وضعیت فعلی

نسخه‌ی عمومی فعلی `v0.1.0` (۶ نوامبر ۲۰۲۶) است؛ یک انتشار pre-1.0 برای نسخه‌ی وب استاتیک. تولید و اسکن QR در مرورگر انجام می‌شود و این نسخه به Backend اختصاصی نیاز ندارد. قابلیت‌های Dynamic Redirect، تحلیل سمت سرور و API در این انتشار وجود ندارند و در Roadmap فاز ۳ قرار دارند. شماره‌ی Phaseها به Major Version نگاشت نمی‌شود و `1.0.0` فقط زمانی منتشر می‌شود که APIها، Schemaها و قراردادهای سازگاری پروژه واقعاً پایدار باشند.

قابلیت‌های Phase 2 در نسخه‌ی `v0.1.0` منتشر شده‌اند: Connected/Fluid neighbour-aware، کنترل مستقل Finderها، Gradientهای چندمرحله‌ای، مهاجرت schema نسخه‌ی ۱ و ۲ به ۳، Presetهای حرفه‌ای، پروژه‌های محلی، Scanner دوربین/تصویر، Safety Simulation، اشتراک‌گذاری فقطِ استایل و Batch محلی تا ۵۰۰ ردیف. اعتبارسنجی نهایی شامل ۲۱۷ تست موفق Playwright، ۸ تست Skip عمدی و صفر تست flaky است.

## امکانات فعلی

- URL، متن، ایمیل، تلفن، SMS، WhatsApp، WiFi، vCard، موقعیت جغرافیایی و رویداد iCalendar
- Smart Detect برای ورودی Paste‌شده
- Renderer اختصاصی SVG و جداسازی Encoding از Styling
- کنترل شکل Module و Finder، Connected/Fluid، رنگ، Gradient، Quiet Zone و Error Correction
- کنترل مستقل Finder بالا-چپ، بالا-راست و پایین-چپ
- لوگوی PNG/JPEG/WebP/SVG با validation و Sanitization و محافظت از Finderها
- 60 Preset داده‌محور با جست‌وجو، دسته‌بندی و Favorite محلی
- Scan Safety Score همراه با Decode واقعی خروجی و مدیریت کنترل‌شده‌ی payload بیش از ظرفیت
- خروجی SVG، PNG، JPEG، WebP و PDF
- Scanner دوربین/تصویر و Scan → Redesign بدون قرار دادن Payload حساس در URL
- Batch محلی CSV/TSV/JSON تا ۵۰۰ ردیف با Worker، Template، خروجی ZIP/PDF و بررسی ظرفیت فایل
- ذخیره‌ی Local Project در IndexedDB و Import/Export فایل JSON نسخه‌دار
- Light/Dark/System، PWA، Offline reuse، SEO و تست‌های خودکار

## حریم خصوصی و امنیت

در حالت Static، داده‌ی QR، رمز WiFi، لوگو و تصویر Scanner برای تولید QR به Backend پروژه ارسال نمی‌شوند. پروژه‌های ذخیره‌شده نیز داخل IndexedDB مرورگر باقی می‌مانند. فایل‌های لوگو و Design JSON به‌عنوان ورودی غیرقابل‌اعتماد اعتبارسنجی می‌شوند و URLهای Scan‌شده خودکار باز نمی‌شوند.

## اجرای پروژه

```bash
corepack prepare pnpm@10.15.0 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

برای تست Local نیازی به دانلود Browserهای Playwright نیست؛ تست Local از Google Chrome نصب‌شده‌ی سیستم استفاده می‌کند. CI ماتریس Chromium/Firefox/WebKit را اجرا می‌کند.

برای Production باید `NEXT_PUBLIC_SITE_URL` روی دامنه‌ی HTTPS واقعی تنظیم شود.

## ساختار

```text
apps/web
packages/core
packages/renderer
packages/presets
packages/scan-validator
packages/shared
```

جزئیات معماری در [Architecture](../architecture/README.md) و ماتریس تست در [Testing](../TESTING.md) قرار دارد.
