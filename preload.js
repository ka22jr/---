const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (d) => ipcRenderer.invoke('login', d),
  getUsers: () => ipcRenderer.invoke('get-users'),
  addUser: (d) => ipcRenderer.invoke('add-user', d),
  updateUser: (d) => ipcRenderer.invoke('update-user', d),

  // Medicines
  getMedicines: (d) => ipcRenderer.invoke('get-medicines', d),
  getMedicine: (id) => ipcRenderer.invoke('get-medicine', id),
  addMedicine: (d) => ipcRenderer.invoke('add-medicine', d),
  updateMedicine: (d) => ipcRenderer.invoke('update-medicine', d),
  deleteMedicine: (id) => ipcRenderer.invoke('delete-medicine', id),
  getCategories: () => ipcRenderer.invoke('get-categories'),

  // Customers
  getCustomers: (q) => ipcRenderer.invoke('get-customers', q),
  addCustomer: (d) => ipcRenderer.invoke('add-customer', d),
  updateCustomer: (d) => ipcRenderer.invoke('update-customer', d),
  getCustomerHistory: (id) => ipcRenderer.invoke('get-customer-history', id),

  // Invoices
  getInvoices: (d) => ipcRenderer.invoke('get-invoices', d),
  getInvoice: (id) => ipcRenderer.invoke('get-invoice', id),
  saveSale: (d) => ipcRenderer.invoke('save-sale', d),
  saveReturn: (d) => ipcRenderer.invoke('save-return', d),
  savePurchase: (d) => ipcRenderer.invoke('save-purchase', d),

  // Expenses
  getExpenses: (m) => ipcRenderer.invoke('get-expenses', m),
  addExpense: (d) => ipcRenderer.invoke('add-expense', d),
  deleteExpense: (id) => ipcRenderer.invoke('delete-expense', id),

  // Reports & Dashboard
  getDashboard: () => ipcRenderer.invoke('get-dashboard'),
  getReport: (d) => ipcRenderer.invoke('get-report', d),
  getOrders: () => ipcRenderer.invoke('get-orders'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (d) => ipcRenderer.invoke('save-settings', d),

  // Backup
  backup: () => ipcRenderer.invoke('backup'),
  getBackups: () => ipcRenderer.invoke('get-backups'),
  openBackupFolder: () => ipcRenderer.invoke('open-backup-folder'),
  exportData: () => ipcRenderer.invoke('export-data'),
});
