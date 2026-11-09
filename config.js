// App settings. Change these, then upload the folder to GitHub again.
window.APP_CONFIG = {
  appName: 'My Budget',

  // Raise this each time you upload a new version (shown in Settings › About).
  // Also raise VERSION at the top of sw.js to the same number, so phones pick up the update.
  appVersion: '1.3.2',

  // Google Apps Script web app link (ends in /exec). See SETUP-GUIDE.md, step 3.
  apiUrl: 'https://script.google.com/macros/s/AKfycbyc35MDaMZAVVaUyZSpS5ndcFhseJAmOH8uYqXyv8HRG1TP4vWxyUJM_K9SwEmY7KCG/exec',

  // Optional: link to the Google Sheet, so Settings › Sync can open it. Leave '' to hide.
  sheetUrl: 'https://docs.google.com/spreadsheets/d/1BDSsM8rjkuvQsYQhBHVjubCRxPbfzfX_jbDtGzUBizE/edit',

  currency: 'AED'
};
