const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Database path in user data folder
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'pharmacy.db');
const backupDir = path.join(userDataPath, 'backups');

if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

// Load SQLite
let db;
try {
  const Database = require('better-sqlite3');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (e) {
  console.error('DB Error:', e);
}

// ==================== INIT DB ====================
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sales',
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      scientific_name TEXT DEFAULT '',
      category TEXT DEFAULT '',
      unit TEXT DEFAULT 'علبة',
      quantity INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      price REAL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      expiry_date TEXT DEFAULT '',
      barcode TEXT DEFAULT '',
      manufacturer TEXT DEFAULT '',
      dosage TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      location TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      balance REAL DEFAULT 0,
      notes TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      customer_name TEXT DEFAULT '',
      supplier TEXT DEFAULT '',
      date TEXT NOT NULL,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      final_total REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'نقدي',
      notes TEXT DEFAULT '',
      cashier TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      medicine_id INTEGER,
      medicine_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL DEFAULT 0,
      total REAL NOT NULL,
      dosage_instructions TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_by TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Insert default users
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (username,password,role,name) VALUES (?,?,?,?)');
  insertUser.run('admin','admin123','admin','المدير');
  insertUser.run('sales','sales123','sales','موظف المبيعات');

  // Insert default settings
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
  [
    ['pharmacy_name','صيدلية الجهاز التنفسي'],
    ['pharmacy_address','كوبري القبة - القاهرة'],
    ['pharmacy_phone','01234567890'],
    ['pharmacy_phone2',''],
    ['expiry_warning_days','60'],
  ].forEach(([k,v]) => insertSetting.run(k,v));

  // Seed medicines if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM medicines').get().c;
  if (count === 0) {
    const ins = db.prepare(`INSERT INTO medicines (name,scientific_name,category,unit,quantity,min_stock,price,cost_price,expiry_date,barcode,manufacturer,dosage) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const meds = [
      ['أموكسيسيلين 500mg','Amoxicillin','مضادات حيوية','علبة',50,10,25,15,'2026-08-01','MED001','GSK','كبسولة كل 8 ساعات'],
      ['باراسيتامول 500mg','Paracetamol','مسكنات','علبة',120,20,8,4,'2027-03-15','MED002','Adwia','قرص كل 6 ساعات'],
      ['أتورفاستاتين 20mg','Atorvastatin','قلب وأوعية','علبة',30,10,45,28,'2026-11-30','MED003','Pfizer','قرص يومياً مع العشاء'],
      ['ميتفورمين 500mg','Metformin','سكري','علبة',60,15,18,10,'2026-12-01','MED004','Marcyrl','قرص مع الوجبات'],
      ['أملوديبين 5mg','Amlodipine','قلب وأوعية','علبة',8,10,35,20,'2026-06-20','MED005','Norvasc','قرص يومياً'],
      ['أوميبرازول 20mg','Omeprazole','جهاز هضمي','علبة',45,10,22,12,'2026-12-15','MED006','AstraZeneca','كبسولة قبل الأكل'],
      ['سالبوتامول بخاخ','Salbutamol','جهاز تنفسي','بخاخ',25,8,55,35,'2026-09-10','MED007','GSK','2 بخة عند الحاجة'],
      ['مونتيلوكاست 10mg','Montelukast','جهاز تنفسي','علبة',40,10,65,42,'2027-01-20','MED008','MSD','قرص يومياً مساءً'],
      ['فلوتيكازون بخاخ','Fluticasone','جهاز تنفسي','بخاخ',5,8,120,80,'2026-04-30','MED009','GSK','2 بخة مرتين يومياً'],
      ['فيتامين C 1000mg','Vitamin C','فيتامينات','علبة',90,15,30,18,'2027-06-01','MED010','Pharco','قرص يومياً'],
      ['زنك 50mg','Zinc','مكملات','علبة',70,10,25,14,'2027-05-01','MED011','Jamjoom','قرص يومياً مع الطعام'],
      ['فيتامين D3','Vitamin D3','فيتامينات','علبة',55,10,40,22,'2027-04-01','MED012','Gulf Pharma','قرص يومياً'],
      ['أسبرين 75mg','Aspirin','قلب وأوعية','علبة',80,20,12,6,'2027-02-01','MED013','Bayer','قرص يومياً مع الطعام'],
      ['سيتيريزين 10mg','Cetirizine','حساسية','علبة',60,15,18,9,'2027-03-01','MED014','UCB','قرص يومياً مساءً'],
      ['ليفوثيروكسين 50mg','Levothyroxine','غدد','علبة',35,10,38,22,'2026-10-01','MED015','Euthyrox','قرص صباحاً قبل الأكل'],
    ];
    meds.forEach(m => ins.run(...m));

    // Seed customers
    const insCust = db.prepare('INSERT INTO customers (name,phone,address,notes) VALUES (?,?,?,?)');
    insCust.run('أحمد محمد','01012345678','القاهرة','عميل منتظم');
    insCust.run('فاطمة حسن','01098765432','كوبري القبة','');
    insCust.run('محمود إبراهيم','01123456789','مصر الجديدة','');
  }
}

// ==================== HELPERS ====================
function today() { return new Date().toISOString().split('T')[0]; }
function daysLeft(exp) {
  if (!exp) return 9999;
  return Math.ceil((new Date(exp) - new Date()) / 86400000);
}
function genInvoiceNo(prefix) {
  const row = db.prepare(`SELECT invoice_no FROM invoices WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1`).get(`${prefix}-%`);
  if (row) {
    const n = parseInt(row.invoice_no.split('-')[1]) + 1;
    return `${prefix}-${String(n).padStart(4,'0')}`;
  }
  return `${prefix}-0001`;
}

// ==================== IPC HANDLERS ====================

// AUTH
ipcMain.handle('login', (e, {username, password}) => {
  const user = db.prepare('SELECT * FROM users WHERE username=? AND password=?').get(username, password);
  return user || null;
});

ipcMain.handle('get-users', () => db.prepare('SELECT id,username,role,name FROM users').all());
ipcMain.handle('add-user', (e, d) => {
  try {
    const r = db.prepare('INSERT INTO users (username,password,role,name) VALUES (?,?,?,?)').run(d.username,d.password,d.role,d.name);
    return { ok: true, id: r.lastInsertRowid };
  } catch { return { error: 'اسم المستخدم موجود بالفعل' }; }
});
ipcMain.handle('update-user', (e, d) => {
  if (d.password) db.prepare('UPDATE users SET name=?,role=?,password=? WHERE id=?').run(d.name,d.role,d.password,d.id);
  else db.prepare('UPDATE users SET name=?,role=? WHERE id=?').run(d.name,d.role,d.id);
  return { ok: true };
});

// MEDICINES
ipcMain.handle('get-medicines', (e, {q='', cat=''}={}) => {
  let sql = 'SELECT * FROM medicines WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (name LIKE ? OR barcode LIKE ? OR scientific_name LIKE ? OR category LIKE ?)'; params.push(...Array(4).fill(`%${q}%`)); }
  if (cat) { sql += ' AND category=?'; params.push(cat); }
  sql += ' ORDER BY name';
  const meds = db.prepare(sql).all(...params);
  return meds.map(m => ({ ...m, days_left: daysLeft(m.expiry_date) }));
});

ipcMain.handle('get-medicine', (e, id) => {
  const m = db.prepare('SELECT * FROM medicines WHERE id=?').get(id);
  return m ? { ...m, days_left: daysLeft(m.expiry_date) } : null;
});

ipcMain.handle('add-medicine', (e, d) => {
  const r = db.prepare(`INSERT INTO medicines (name,scientific_name,category,unit,quantity,min_stock,price,cost_price,expiry_date,barcode,manufacturer,dosage,notes,location) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    d.name,d.scientific_name||'',d.category||'',d.unit||'علبة',
    +d.quantity||0,+d.min_stock||5,+d.price||0,+d.cost_price||0,
    d.expiry_date||'',d.barcode||'',d.manufacturer||'',d.dosage||'',d.notes||'',d.location||'');
  return { ok: true, id: r.lastInsertRowid };
});

ipcMain.handle('update-medicine', (e, d) => {
  db.prepare(`UPDATE medicines SET name=?,scientific_name=?,category=?,unit=?,quantity=?,min_stock=?,price=?,cost_price=?,expiry_date=?,barcode=?,manufacturer=?,dosage=?,notes=?,location=? WHERE id=?`).run(
    d.name,d.scientific_name||'',d.category||'',d.unit||'علبة',
    +d.quantity||0,+d.min_stock||5,+d.price||0,+d.cost_price||0,
    d.expiry_date||'',d.barcode||'',d.manufacturer||'',d.dosage||'',d.notes||'',d.location||'',d.id);
  return { ok: true };
});

ipcMain.handle('delete-medicine', (e, id) => {
  db.prepare('DELETE FROM medicines WHERE id=?').run(id);
  return { ok: true };
});

ipcMain.handle('get-categories', () => {
  return db.prepare("SELECT DISTINCT category FROM medicines WHERE category!='' ORDER BY category").all().map(r=>r.category);
});

// CUSTOMERS
ipcMain.handle('get-customers', (e, q='') => {
  if (q) return db.prepare('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name').all(`%${q}%`,`%${q}%`);
  return db.prepare('SELECT * FROM customers ORDER BY name').all();
});

ipcMain.handle('add-customer', (e, d) => {
  const r = db.prepare('INSERT INTO customers (name,phone,address,notes) VALUES (?,?,?,?)').run(d.name,d.phone||'',d.address||'',d.notes||'');
  return { ok: true, id: r.lastInsertRowid };
});

ipcMain.handle('update-customer', (e, d) => {
  db.prepare('UPDATE customers SET name=?,phone=?,address=?,notes=? WHERE id=?').run(d.name,d.phone||'',d.address||'',d.notes||'',d.id);
  return { ok: true };
});

ipcMain.handle('get-customer-history', (e, id) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(id);
  const invs = db.prepare("SELECT * FROM invoices WHERE customer_name=? ORDER BY id DESC").all(c?.name||'');
  return { customer: c, invoices: invs };
});

// INVOICES
ipcMain.handle('get-invoices', (e, {type, from='', to=''}={}) => {
  let sql = 'SELECT * FROM invoices WHERE type=?';
  const params = [type];
  if (from) { sql += ' AND date >= ?'; params.push(from); }
  if (to) { sql += ' AND date <= ?'; params.push(to); }
  sql += ' ORDER BY id DESC';
  return db.prepare(sql).all(...params);
});

ipcMain.handle('get-invoice', (e, id) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(id);
  if (inv) inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(id);
  return inv;
});

ipcMain.handle('save-sale', (e, d) => {
  const items = d.items || [];
  if (!items.length) return { error: 'لا توجد أصناف' };
  const subtotal = items.reduce((a,i) => a + i.quantity * i.price, 0);
  const discount = +d.discount || 0;
  const final_total = subtotal - discount;
  const no = genInvoiceNo('INV');

  const saveTx = db.transaction(() => {
    const r = db.prepare(`INSERT INTO invoices (invoice_no,type,customer_name,date,subtotal,discount,final_total,payment_method,notes,cashier) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      no,'sale',d.customer_name||'نقدي',today(),subtotal,discount,final_total,d.payment_method||'نقدي',d.notes||'',d.cashier||'');
    const invId = r.lastInsertRowid;
    for (const item of items) {
      const med = db.prepare('SELECT * FROM medicines WHERE id=?').get(item.medicine_id);
      if (!med) continue;
      db.prepare(`INSERT INTO invoice_items (invoice_id,medicine_id,medicine_name,quantity,unit_price,cost_price,total,dosage_instructions) VALUES (?,?,?,?,?,?,?,?)`).run(
        invId,item.medicine_id,med.name,item.quantity,item.price,med.cost_price,item.quantity*item.price,item.dosage||'');
      db.prepare('UPDATE medicines SET quantity=quantity-? WHERE id=?').run(item.quantity,item.medicine_id);
    }
    return invId;
  });
  const id = saveTx();
  return { ok: true, invoice_no: no, id, final_total };
});

ipcMain.handle('save-return', (e, d) => {
  const items = d.items || [];
  if (!items.length) return { error: 'لا توجد أصناف' };
  const total = items.reduce((a,i) => a + i.quantity * i.price, 0);
  const no = genInvoiceNo('RET');
  const tx = db.transaction(() => {
    const r = db.prepare(`INSERT INTO invoices (invoice_no,type,customer_name,date,subtotal,discount,final_total,notes,cashier) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      no,'return',d.customer_name||'',today(),total,0,total,d.reason||'',d.cashier||'');
    const invId = r.lastInsertRowid;
    for (const item of items) {
      db.prepare(`INSERT INTO invoice_items (invoice_id,medicine_id,medicine_name,quantity,unit_price,total) VALUES (?,?,?,?,?,?)`).run(invId,item.medicine_id||null,item.name,item.quantity,item.price,item.quantity*item.price);
      if (item.medicine_id) db.prepare('UPDATE medicines SET quantity=quantity+? WHERE id=?').run(item.quantity,item.medicine_id);
    }
    return invId;
  });
  const id = tx();
  return { ok: true, invoice_no: no, id };
});

ipcMain.handle('save-purchase', (e, d) => {
  const items = d.items || [];
  if (!items.length) return { error: 'لا توجد أصناف' };
  const total = items.reduce((a,i) => a + i.quantity * i.cost_price, 0);
  const no = genInvoiceNo('PUR');
  const tx = db.transaction(() => {
    const r = db.prepare(`INSERT INTO invoices (invoice_no,type,supplier,customer_name,date,subtotal,discount,final_total,notes,cashier) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      no,'purchase',d.supplier||'',d.receiver||'',today(),total,0,total,d.notes||'',d.cashier||'');
    const invId = r.lastInsertRowid;
    for (const item of items) {
      db.prepare(`INSERT INTO invoice_items (invoice_id,medicine_id,medicine_name,quantity,unit_price,cost_price,total) VALUES (?,?,?,?,?,?,?)`).run(invId,item.medicine_id,item.name,item.quantity,item.cost_price,item.cost_price,item.quantity*item.cost_price);
      db.prepare('UPDATE medicines SET quantity=quantity+?, cost_price=? WHERE id=?').run(item.quantity,item.cost_price,item.medicine_id);
      if (item.new_expiry) db.prepare('UPDATE medicines SET expiry_date=? WHERE id=?').run(item.new_expiry,item.medicine_id);
    }
    return invId;
  });
  const id = tx();
  return { ok: true, invoice_no: no, id };
});

// EXPENSES
ipcMain.handle('get-expenses', (e, month) => {
  const rows = db.prepare("SELECT * FROM expenses WHERE date LIKE ? ORDER BY date DESC").all(`${month}%`);
  const total = rows.reduce((a,r) => a+r.amount, 0);
  const cats = db.prepare("SELECT category, SUM(amount) as total FROM expenses WHERE date LIKE ? GROUP BY category").all(`${month}%`);
  return { expenses: rows, total, by_category: cats };
});

ipcMain.handle('add-expense', (e, d) => {
  const r = db.prepare('INSERT INTO expenses (category,description,amount,date,notes,created_by) VALUES (?,?,?,?,?,?)').run(d.category,d.description,+d.amount,d.date||today(),d.notes||'',d.created_by||'');
  return { ok: true, id: r.lastInsertRowid };
});

ipcMain.handle('delete-expense', (e, id) => {
  db.prepare('DELETE FROM expenses WHERE id=?').run(id);
  return { ok: true };
});

// REPORTS
ipcMain.handle('get-report', (e, {from, to}) => {
  const summary = db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN type='sale' THEN final_total END),0) as revenue,
    COALESCE(SUM(CASE WHEN type='return' THEN final_total END),0) as returns,
    COUNT(CASE WHEN type='sale' THEN 1 END) as sale_count,
    COUNT(CASE WHEN type='return' THEN 1 END) as return_count
    FROM invoices WHERE date BETWEEN ? AND ?`).get(from, to);
  const purchases = db.prepare("SELECT COALESCE(SUM(final_total),0) as total FROM invoices WHERE type='purchase' AND date BETWEEN ? AND ?").get(from,to);
  const expenses = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date BETWEEN ? AND ?").get(from,to);
  const top_meds = db.prepare(`SELECT ii.medicine_name, SUM(ii.quantity) as total_qty, SUM(ii.total) as total_rev
    FROM invoice_items ii JOIN invoices i ON ii.invoice_id=i.id
    WHERE i.type='sale' AND i.date BETWEEN ? AND ?
    GROUP BY ii.medicine_name ORDER BY total_rev DESC LIMIT 10`).all(from,to);
  const daily = db.prepare(`SELECT date, SUM(final_total) as total, COUNT(*) as count
    FROM invoices WHERE type='sale' AND date BETWEEN ? AND ? GROUP BY date ORDER BY date`).all(from,to);
  const net = summary.revenue - summary.returns;
  const profit = net - purchases.total - expenses.total;
  return { summary, purchases: purchases.total, expenses: expenses.total, net_revenue: net, profit, top_meds, daily };
});

// ORDERS
ipcMain.handle('get-orders', () => {
  const meds = db.prepare('SELECT * FROM medicines WHERE quantity <= min_stock ORDER BY quantity ASC').all();
  const monthAgo = new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
  return meds.map(m => {
    const sold = db.prepare(`SELECT COALESCE(SUM(ii.quantity),0) as qty FROM invoice_items ii JOIN invoices i ON ii.invoice_id=i.id WHERE i.type='sale' AND ii.medicine_id=? AND i.date >= ?`).get(m.id, monthAgo);
    const suggested = Math.max(m.min_stock * 3 - m.quantity, m.min_stock);
    return { ...m, monthly_sold: sold.qty, suggested, estimated_cost: suggested * m.cost_price, days_left_expiry: daysLeft(m.expiry_date) };
  });
});

// SETTINGS
ipcMain.handle('get-settings', () => {
  const rows = db.prepare('SELECT * FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
});

ipcMain.handle('save-settings', (e, d) => {
  const ins = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
  for (const [k,v] of Object.entries(d)) ins.run(k,v);
  return { ok: true };
});

// DASHBOARD
ipcMain.handle('get-dashboard', () => {
  const t = today(), m = t.slice(0,7);
  const today_sales = db.prepare("SELECT COALESCE(SUM(final_total),0) as total, COUNT(*) as count FROM invoices WHERE type='sale' AND date=?").get(t);
  const month_sales = db.prepare("SELECT COALESCE(SUM(final_total),0) as total, COUNT(*) as count FROM invoices WHERE type='sale' AND date LIKE ?").get(`${m}%`);
  const total_inv = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(quantity),0) as qty FROM medicines').get();
  const low_stock = db.prepare('SELECT * FROM medicines WHERE quantity <= min_stock AND quantity > 0 ORDER BY quantity ASC LIMIT 8').all();
  const expiry_warn = db.prepare("SELECT * FROM medicines WHERE expiry_date != '' ORDER BY expiry_date ASC").all();
  const expiry_soon = expiry_warn.filter(m => { const d=daysLeft(m.expiry_date); return d>0&&d<=60; }).slice(0,8).map(m=>({...m,days_left:daysLeft(m.expiry_date)}));
  const expired = expiry_warn.filter(m => daysLeft(m.expiry_date) <= 0);
  const recent_sales = db.prepare("SELECT * FROM invoices WHERE type='sale' ORDER BY id DESC LIMIT 8").all();
  const top_meds = db.prepare(`SELECT medicine_name, SUM(quantity) as total_qty, SUM(total) as total_rev FROM invoice_items ii JOIN invoices i ON ii.invoice_id=i.id WHERE i.type='sale' GROUP BY medicine_name ORDER BY total_rev DESC LIMIT 5`).all();
  const weekly = [];
  for (let i=6;i>=0;i--) {
    const d = new Date(Date.now()-i*86400000).toISOString().split('T')[0];
    const r = db.prepare("SELECT COALESCE(SUM(final_total),0) as t FROM invoices WHERE type='sale' AND date=?").get(d);
    weekly.push({date:d, total:r.t});
  }
  return { today_sales, month_sales, total_inv, low_stock: low_stock.map(m=>({...m,days_left:daysLeft(m.expiry_date)})), expiry_soon, expired_count: expired.length, recent_sales, top_meds, weekly_chart: weekly, alerts: low_stock.length+expiry_soon.length+expired.length };
});

// BACKUP
ipcMain.handle('backup', async () => {
  const ts = new Date().toISOString().replace(/[:.]/g,'_').slice(0,19);
  const backupPath = path.join(backupDir, `backup_${ts}.db`);
  fs.copyFileSync(dbPath, backupPath);
  // Keep only last 20 backups
  const files = fs.readdirSync(backupDir).filter(f=>f.endsWith('.db')).sort();
  if (files.length > 20) files.slice(0, files.length-20).forEach(f => fs.unlinkSync(path.join(backupDir,f)));
  return { ok: true, file: `backup_${ts}.db` };
});

ipcMain.handle('get-backups', () => {
  return fs.readdirSync(backupDir).filter(f=>f.endsWith('.db')).sort().reverse();
});

ipcMain.handle('open-backup-folder', () => {
  shell.openPath(backupDir);
  return { ok: true };
});

ipcMain.handle('export-data', async () => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'تصدير البيانات',
    defaultPath: `pharmacy_backup_${today()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!filePath) return { ok: false };
  const data = {
    medicines: db.prepare('SELECT * FROM medicines').all(),
    invoices: db.prepare('SELECT * FROM invoices').all(),
    invoice_items: db.prepare('SELECT * FROM invoice_items').all(),
    customers: db.prepare('SELECT * FROM customers').all(),
    expenses: db.prepare('SELECT * FROM expenses').all(),
    exported: new Date().toISOString()
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true, path: filePath };
});

// ==================== WINDOW ====================
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 650,
    title: 'صيدلية الجهاز التنفسي',
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    backgroundColor: '#f0f4f8'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  initDB();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
