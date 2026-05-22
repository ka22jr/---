#!/usr/bin/env node
/**
 * Pharmacy Management System - Auto Build Script
 * This script automatically builds the .exe file
 * Usage: node auto-build.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(msg, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    error: '\x1b[31m',   // red
    warn: '\x1b[33m',    // yellow
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type] || colors.info}${msg}${reset}`);
}

async function runCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: true, stdio: 'inherit' });
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

async function main() {
  try {
    log('\n========================================', 'info');
    log('  صيدلية الجهاز التنفسي - أداة البناء', 'info');
    log('========================================\n', 'info');

    // Check Node.js version
    log('✓ التحقق من الإصدارات...', 'info');
    const nodeVersion = process.version;
    log(`  Node.js: ${nodeVersion}\n`, 'success');

    // Create assets
    log('✓ إعداد المجلدات...', 'info');
    const assetsDir = path.join(__dirname, 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
      log('  تم إنشاء مجلد assets', 'success');
    }

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
      log('  تم إنشاء icon.ico', 'success');
    }

    log('\n✓ تثبيت المتطلبات...', 'info');
    log('  (قد يأخذ دقائق - الرجاء الانتظار)\n', 'warn');
    await runCommand('npm install');
    log('  تم التثبيت بنجاح\n', 'success');

    log('✓ جاري بناء التطبيق...', 'info');
    log('  (قد يأخذ 5-15 دقيقة - الرجاء الانتظار)\n', 'warn');
    await runCommand('npm run build');

    // Check results
    log('\n========================================', 'info');
    const distDir = path.join(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      const files = fs.readdirSync(distDir).filter(f => f.endsWith('.exe'));
      if (files.length > 0) {
        log('✅ تم البناء بنجاح!\n', 'success');
        log('الملفات الجاهزة للتحميل:', 'info');
        files.forEach(file => {
          const filePath = path.join(distDir, file);
          const stats = fs.statSync(filePath);
          const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          log(`  📦 ${file} (${sizeMB} MB)`, 'success');
        });
        log(`\n📁 المسار: ${distDir}\n`, 'info');
      }
    }
    log('========================================\n', 'info');

  } catch (error) {
    log(`\n❌ خطأ: ${error.message}\n`, 'error');
    process.exit(1);
  }
}

main();
