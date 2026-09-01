# ModuQR — راهنمای فارسی

ModuQR یک استودیوی متن‌باز برای ساخت، طراحی و اسکن QR است که دو اصل را جدی می‌گیرد: **حفظ قابلیت اسکن** و **حریم خصوصی در حالت Static**.

## وضعیت فعلی

کد موجود در مرحله‌ی توسعه‌ی pre-1.0 است و نسخه‌ی فعلی Repository برابر `0.1.0` است. اولین Release عمومی فقط پس از پاس کامل Dependency Install، TypeScript، Lint، Unit Test، Production Build، Playwright، Accessibility و Dependency Audit با برچسب `v0.1.0` منتشر می‌شود. شماره‌ی Phaseها به Major Version نگاشت نمی‌شود و `1.0.0` فقط برای زمانی رزرو است که APIها، Schemaها و قراردادهای سازگاری پروژه واقعاً پایدار شده باشند.

## امکانات فاز اول

- URL، متن، ایمیل، تلفن، SMS، WhatsApp، WiFi، vCard، موقعیت جغرافیایی و رویداد iCalendar
- Smart Detect برای ورودی Paste‌شده
- Renderer اختصاصی SVG و جداسازی Encoding از Styling
- کنترل شکل Module و Finder، رنگ، Gradient، Quiet Zone و Error Correction
- لوگوی PNG/JPEG/WebP/SVG با Sanitization و محافظت از Finderها
- 24 Preset داده‌محور
- Scan Safety Score همراه با Decode واقعی خروجی
- خروجی SVG، PNG، JPEG، WebP و PDF
- Scanner تصویری و Scan → Redesign بدون قرار دادن Payload حساس در URL
- ذخیره‌ی Local Project در IndexedDB و Import/Export فایل JSON نسخه‌دار
- Light/Dark/System، PWA، Offline reuse، SEO و تست‌های خودکار

## حریم خصوصی

در حالت Static، داده‌ی QR، رمز WiFi، لوگو و تصویر Scanner برای تولید QR به Backend پروژه ارسال نمی‌شوند. پروژه‌های ذخیره‌شده نیز داخل IndexedDB مرورگر باقی می‌مانند.

## اجرای پروژه

```bash
corepack enable
corepack prepare pnpm@10.15.0 --activate
pnpm install
pnpm dev
```

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
