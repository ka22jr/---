# 🚀 تعليمات البناء والتطوير

## المتطلبات الأساسية
- Node.js v14+ ([تحميل](https://nodejs.org/))
- npm (يأتي مع Node.js)

## خطوات التطوير والبناء

### 1. تثبيت المتطلبات
```bash
npm install
```

### 2. تشغيل التطبيق في وضع التطوير
```bash
npm start
```

### 3. بناء ملف .exe

#### الخيار 1: بناء Installer (محترف)
```bash
npm run build-installer
```
سينتج عنه:
- `صيدلية الجهاز التنفسي Setup.exe` - ملف installer

#### الخيار 2: بناء ملف Portable (بدون installer)
```bash
npm run build-portable
```
سينتج عنه:
- `صيدلية الجهاز التنفسي.exe` - ملف واحد مباشر

#### الخيار 3: بناء كلا الخيارين
```bash
npm run build
```

### 4. البحث عن الملفات المبنية
ستجد الملفات المبنية في مجلد:
```
dist/
```

## هيكل المشروع
```
pharmacy-system/
├── src/
│   ├── main.js          # ملف Electron الرئيسي
│   ├── preload.js       # جسر الاتصال بين Electron و UI
│   ├── index.html       # الواجهة الرئيسية
│   └── renderer.js      # منطق الواجهة
├── assets/
│   └── icon.ico         # أيقونة التطبيق
├── package.json         # إعدادات npm و electron-builder
└── README.md
```

## حل المشاكل

### مشكلة: "better-sqlite3 build failed"
**الحل:**
```bash
npm install --build-from-source
```

### مشكلة: لا يجد ملف icon.ico
**الحل:**
تأكد من وجود `assets/icon.ico` في مجلد المشروع

### مشكلة: بطء البناء في المرة الأولى
**هذا طبيعي** - Electron كبير الحجم ويتم تنزيله مرة واحدة فقط

## نصائح
- ✅ استخدم `npm start` للاختبار السريع
- ✅ استخدم `build-portable` لملف واحد صغير
- ✅ استخدم `build-installer` للتوزيع الاحترافي
- 💾 البيانات تُحفظ في `AppData\Local\pharmacy-system\`

---
**📝 ملاحظة:** تم إنشاء icon placeholder - يمكنك استبداله برسمة فعلية
