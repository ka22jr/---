#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🚀 بدء عملية البناء...');
console.log('════════════════════════════════════════\n');

// Step 1: Create assets directory
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
  console.log('✅ تم إنشاء مجلد assets');
}

// Step 2: Create icon if not exists
const iconPath = path.join(assetsDir, 'icon.ico');
if (!fs.existsSync(iconPath)) {
  const icoBuffer = Buffer.from([
    0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x20, 0x20,
    0x00, 0x00, 0x01, 0x00, 0x20, 0x00, 0x68, 0x04,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00, 0x28, 0x00,
    0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x40, 0x00,
    0x00, 0x00, 0x01, 0x00, 0x20, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0xc4, 0x0e,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  fs.writeFileSync(iconPath, icoBuffer);
  console.log('✅ تم إنشاء icon.ico');
}

// Step 3: Install dependencies
console.log('\n⏳ تثبيت المتطلبات (هذا قد يأخذ دقائق)...\n');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('\n✅ تم تثبيت المتطلبات بنجاح');
} catch (e) {
  console.error('❌ خطأ في التثبيت');
  process.exit(1);
}

// Step 4: Build exe
console.log('\n⏳ جاري بناء ملف .exe (قد يأخذ 5-15 دقيقة)...\n');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('\n✅ تم البناء بنجاح!');
} catch (e) {
  console.error('\n❌ خطأ في البناء');
  process.exit(1);
}

// Step 5: Check if files exist
console.log('\n════════════════════════════════════════');
console.log('🎉 تم الانتهاء!\n');

const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir);
  const exeFiles = files.filter(f => f.endsWith('.exe'));
  
  if (exeFiles.length > 0) {
    console.log('📁 الملفات الجاهزة للتحميل:\n');
    exeFiles.forEach(file => {
      const filePath = path.join(distDir, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  ✅ ${file} (${sizeMB} MB)`);
    });
    console.log(`\n📁 المسار: dist/`);
    console.log('\n🚀 يمكنك الآن تحميل الملفات من مجلد dist/');
  }
}

console.log('\n════════════════════════════════════════\n');
