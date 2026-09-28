# سفارش

سامانه خرید و مقایسه مواد اولیه کافه‌ها و رستوران‌ها، ساخته‌شده با Next.js 16، Auth.js و MongoDB.

## راه‌اندازی

```bash
npm install
copy .env.example .env.local
npm run dev
```

مقادیر `.env.local` را پیش از اجرا تکمیل کنید. برای ساخت `AUTH_SECRET` می‌توانید از دستور زیر استفاده کنید:

```bash
npx auth secret
```

## ورود با Google

در Google Cloud یک OAuth 2.0 Web Client بسازید و آدرس callback زیر را برای محیط محلی ثبت کنید:

```text
http://localhost:3000/api/auth/callback/google
```

سپس Client ID و Client Secret را به‌ترتیب در `AUTH_GOOGLE_ID` و `AUTH_GOOGLE_SECRET` قرار دهید. در محیط production، callback متناظر با دامنه اصلی را نیز ثبت کنید.

## جریان ثبت‌نام

- ثبت‌نام با ایمیل و رمز عبور، همراه با hash امن رمز و اعتبارسنجی سمت سرور
- ثبت‌نام یا ورود Google فقط با ایمیل تأییدشده
- session مبتنی بر JWT با شناسه، نقش و وضعیت onboarding
- onboarding دو مرحله‌ای برای انتخاب کافه/رستوران یا تأمین‌کننده
- ایجاد idempotent پروفایل کسب‌وکار و عضویت مالک کافه
- قفل موقت حساب بعد از پنج تلاش ناموفق ورود

## بررسی کیفیت

```bash
npm run lint
npm run typecheck
npm run build
```
