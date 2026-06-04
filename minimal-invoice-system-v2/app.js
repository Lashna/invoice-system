const $ = (id) => document.getElementById(id);
const currencyFormatter = () => $('currency').value || 'LKR';
let logoData = localStorage.getItem('invoice_logo') || '';
let items = JSON.parse(localStorage.getItem('invoice_items') || '[]');
let savedItems = JSON.parse(localStorage.getItem('invoice_saved_items') || '[]');
let supabaseClient = null;
let currentUser = null;
if (!items.length) items = [{ name: 'Logo Design Package', qty: 1, price: 25000 }];
if (!savedItems.length) savedItems = [
  { name: 'Logo Design Package', qty: 1, price: 25000 },
  { name: 'Brand Identity Package', qty: 1, price: 75000 },
  { name: 'Social Media Post Design', qty: 1, price: 3500 }
];

const fields = [
  'businessName','businessEmail','businessPhone','businessAddress','invoiceNumber','invoiceDate','dueDate',
  'clientName','clientEmail','clientPhone','clientAddress','discount','tax','paidAmount','paymentDetails','notes','accentColor','currency'
];

function today(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0,10); }
function money(n) { return `${currencyFormatter()} ${Number(n || 0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}`; }
function getVal(id, fallback = '') { return $(id).value || fallback; }
function getNumber(id) { return Number($(id).value || 0); }
function nextInvoiceNumber() { const history = JSON.parse(localStorage.getItem('invoice_history') || '[]'); return `INV-${String(history.length + 1).padStart(4, '0')}`; }
function applyAccent() { document.documentElement.style.setProperty('--accent', $('accentColor').value || '#111827'); }
function appData() {
  return {
    draft: Object.fromEntries(fields.map(id => [id, $(id)?.value || ''])),
    items, savedItems,
    history: JSON.parse(localStorage.getItem('invoice_history') || '[]'),
    logoData
  };
}
function saveDraft() {
  const data = {}; fields.forEach(id => data[id] = $(id).value);
  localStorage.setItem('invoice_draft', JSON.stringify(data));
  localStorage.setItem('invoice_items', JSON.stringify(items));
  localStorage.setItem('invoice_saved_items', JSON.stringify(savedItems));
}
function restoreAppData(data) {
  if (!data) return;
  localStorage.setItem('invoice_draft', JSON.stringify(data.draft || {}));
  localStorage.setItem('invoice_items', JSON.stringify(data.items || []));
  localStorage.setItem('invoice_saved_items', JSON.stringify(data.savedItems || []));
  localStorage.setItem('invoice_history', JSON.stringify(data.history || []));
  if (data.logoData) localStorage.setItem('invoice_logo', data.logoData); else localStorage.removeItem('invoice_logo');
  logoData = data.logoData || '';
  items = data.items?.length ? data.items : [{ name: 'Logo Design Package', qty: 1, price: 25000 }];
  savedItems = data.savedItems?.length ? data.savedItems : savedItems;
  loadDraft();
}
function loadDraft() {
  const saved = JSON.parse(localStorage.getItem('invoice_draft') || '{}');
  const defaults = {
    businessName: 'SEVEN ELEMENTS', businessEmail: 'hello@sevenelements.lk', businessPhone: '+94 XX XXX XXXX', businessAddress: 'Colombo, Sri Lanka',
    invoiceNumber: nextInvoiceNumber(), invoiceDate: today(), dueDate: today(7), clientName: '', clientEmail: '', clientPhone: '', clientAddress: '',
    discount: '0', tax: '0', paidAmount: '0', paymentDetails: '', notes: 'Thank you for your business.', accentColor: '#111827', currency: 'LKR'
  };
  fields.forEach(id => { $(id).value = saved[id] ?? defaults[id] ?? ''; });
  applyAccent(); renderItemsEditor(); renderSavedItems(); updatePreview(); updateDashboard(); updateCloudStatus();
}
function setLogoDisplays() {
  const html = logoData ? `<img src="${logoData}" alt="Logo">` : 'SE';
  $('logoBox').innerHTML = logoData ? `<img src="${logoData}" alt="Logo">` : 'Upload Logo';
  $('previewLogo').innerHTML = html; $('brandMark').innerHTML = html;
}
function savedItemOptions(selectedName = '') {
  return `<option value="">Select saved item</option>` + savedItems.map((it, i) => `<option value="${i}" ${it.name === selectedName ? 'selected' : ''}>${it.name}</option>`).join('');
}
function renderItemsEditor() {
  $('itemsEditor').innerHTML = items.map((item, index) => `
    <div class="item-row">
      <label>Item<input data-field="name" data-index="${index}" value="${item.name || ''}" placeholder="Service name" /></label>
      <label>Qty<input data-field="qty" data-index="${index}" type="number" min="0" value="${item.qty || 1}" /></label>
      <label>Price<input data-field="price" data-index="${index}" type="number" min="0" value="${item.price || 0}" /></label>
      <button class="ghost-btn small save-row-item" data-save-row="${index}">Save</button>
      <button class="remove-item" data-remove="${index}">×</button>
    </div>`).join('');
  document.querySelectorAll('[data-field]').forEach(input => input.addEventListener('input', e => {
    const i = Number(e.target.dataset.index); const f = e.target.dataset.field;
    items[i][f] = f === 'name' ? e.target.value : Number(e.target.value);
    updatePreview(); saveDraft();
  }));
  document.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', e => {
    if (items.length > 1) items.splice(Number(e.target.dataset.remove), 1);
    renderItemsEditor(); updatePreview(); saveDraft();
  }));
  document.querySelectorAll('[data-save-row]').forEach(btn => btn.addEventListener('click', e => {
    const row = items[Number(e.target.dataset.saveRow)];
    if (!row.name) return alert('Please enter item name first.');
    saveItemToLibrary(row.name, row.qty || 1, row.price || 0);
    alert('Item saved to library!');
  }));
}
function saveItemToLibrary(name, qty, price) {
  const existing = savedItems.findIndex(i => i.name.toLowerCase() === String(name).toLowerCase());
  const newItem = { name, qty: Number(qty || 1), price: Number(price || 0) };
  if (existing >= 0) savedItems[existing] = newItem; else savedItems.unshift(newItem);
  localStorage.setItem('invoice_saved_items', JSON.stringify(savedItems)); renderSavedItems(); saveDraft();
}
function renderSavedItems() {
  $('savedItemsList').innerHTML = savedItems.length ? savedItems.map((item, i) => `
    <div class="saved-item">
      <div><strong>${item.name}</strong><span>Qty ${item.qty} · ${money(item.price)}</span></div>
      <div class="button-row">
        <button class="ghost-btn small" data-add-saved="${i}">Add to Invoice</button>
        <button class="ghost-btn small" data-edit-saved="${i}">Edit</button>
        <button class="ghost-btn small" data-delete-saved="${i}">Delete</button>
      </div>
    </div>`).join('') : '<p class="muted">No saved items yet.</p>';
  document.querySelectorAll('[data-add-saved]').forEach(btn => btn.addEventListener('click', e => addSavedItem(Number(e.target.dataset.addSaved))));
  document.querySelectorAll('[data-edit-saved]').forEach(btn => btn.addEventListener('click', e => {
    const item = savedItems[Number(e.target.dataset.editSaved)];
    $('savedItemName').value = item.name; $('savedItemQty').value = item.qty; $('savedItemPrice').value = item.price;
  }));
  document.querySelectorAll('[data-delete-saved]').forEach(btn => btn.addEventListener('click', e => {
    if (!confirm('Delete this saved item?')) return;
    savedItems.splice(Number(e.target.dataset.deleteSaved), 1);
    renderSavedItems(); saveDraft();
  }));
}
function addSavedItem(index = null) {
  if (index === null) {
    const names = savedItems.map((it, i) => `${i + 1}. ${it.name} - ${money(it.price)}`).join('\n');
    const choice = prompt(`Enter saved item number:\n\n${names}`);
    if (!choice) return;
    index = Number(choice) - 1;
  }
  const item = savedItems[index]; if (!item) return alert('Saved item not found.');
  items.push({ ...item }); renderItemsEditor(); updatePreview(); saveDraft(); showPanel('invoicePanel');
}
function calculateTotals() {
  const subtotal = items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  const discountAmount = subtotal * (getNumber('discount') / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * (getNumber('tax') / 100);
  const total = afterDiscount + taxAmount;
  const paidAmount = Math.min(getNumber('paidAmount'), total);
  const balanceDue = Math.max(total - paidAmount, 0);
  return { subtotal, discountAmount, taxAmount, total, paidAmount, balanceDue };
}
function updatePreview() {
  applyAccent(); setLogoDisplays();
  $('previewBusinessName').textContent = getVal('businessName','SEVEN ELEMENTS');
  $('sideBusinessName').textContent = getVal('businessName','Invoice Studio');
  $('previewBusinessInfo').innerHTML = `${getVal('businessAddress','Colombo, Sri Lanka')}<br>${getVal('businessEmail','hello@business.com')} | ${getVal('businessPhone','+94 XX XXX XXXX')}`;
  $('previewInvoiceNumber').textContent = getVal('invoiceNumber','INV-0001');
  $('previewDate').textContent = getVal('invoiceDate','-'); $('previewDueDate').textContent = getVal('dueDate','-');
  $('previewClientName').textContent = getVal('clientName','Client Name');
  $('previewClientInfo').innerHTML = `${getVal('clientAddress','Client address')}<br>${getVal('clientEmail','client@email.com')} | ${getVal('clientPhone','Phone')}`;
  $('previewItems').innerHTML = items.map(item => `<tr><td>${item.name || '-'}</td><td>${item.qty || 0}</td><td>${money(item.price || 0)}</td><td>${money((item.qty || 0) * (item.price || 0))}</td></tr>`).join('');
  $('previewPayment').textContent = getVal('paymentDetails','-'); $('previewNotes').textContent = getVal('notes','Thank you for your business.');
  const totals = calculateTotals();
  $('subtotalText').textContent = money(totals.subtotal); $('discountText').textContent = money(totals.discountAmount); $('taxText').textContent = money(totals.taxAmount);
  $('grandTotalText').textContent = money(totals.total); $('paidAmountText').textContent = money(totals.paidAmount); $('balanceDueText').textContent = money(totals.balanceDue);
  updateDashboard(); saveDraft();
}
function updateDashboard() {
  const history = JSON.parse(localStorage.getItem('invoice_history') || '[]');
  $('totalInvoices').textContent = history.length;
  $('totalValue').textContent = money(history.reduce((sum, inv) => sum + Number(inv.total || 0), 0));
  $('totalBalanceDue').textContent = money(history.reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0));
  $('latestInvoice').textContent = history[0]?.invoiceNumber || '-'; renderHistory();
}
function renderHistory() {
  const history = JSON.parse(localStorage.getItem('invoice_history') || '[]');
  $('historyList').innerHTML = history.length ? history.map((inv, i) => `
    <div class="history-item">
      <div><strong>${inv.invoiceNumber}</strong><span>${inv.clientName || 'Client'} · ${inv.date} · Balance Due: ${money(inv.balanceDue || 0)}</span></div>
      <div><strong>${money(inv.total)}</strong><button class="ghost-btn small" data-load-history="${i}">Load</button></div>
    </div>`).join('') : '<p class="muted">No saved invoices yet.</p>';
  document.querySelectorAll('[data-load-history]').forEach(btn => btn.addEventListener('click', e => {
    const inv = history[Number(e.target.dataset.loadHistory)];
    fields.forEach(id => { if (inv[id] !== undefined) $(id).value = inv[id]; });
    items = inv.items || items; renderItemsEditor(); updatePreview(); showPanel('invoicePanel');
  }));
}
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active')); $(id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.panel === id));
}
function isSupabaseConfigured() {
  return window.SUPABASE_URL && window.SUPABASE_ANON_KEY && !String(window.SUPABASE_URL).includes('PASTE_') && window.supabase;
}
function initSupabase() {
  if (!isSupabaseConfigured()) return;
  supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  supabaseClient.auth.getUser().then(({ data }) => { currentUser = data?.user || null; updateCloudStatus(); });
}
function updateCloudStatus(message = '') {
  const status = $('cloudStatus'); if (!status) return;
  if (!isSupabaseConfigured()) { status.textContent = 'Cloud sync not configured. Local browser save is active.'; $('storageStatus').textContent = 'Local browser save active.'; return; }
  status.textContent = message || (currentUser ? `Cloud sync ready. Logged in as ${currentUser.email}` : 'Cloud configured. Please login or sign up.');
  $('storageStatus').textContent = currentUser ? 'Cloud sync ready + local save active.' : 'Cloud configured, login required.';
}
async function signUp() {
  if (!supabaseClient) return alert('Please configure supabase-config.js first.');
  const { data, error } = await supabaseClient.auth.signUp({ email: $('authEmail').value, password: $('authPassword').value });
  if (error) return alert(error.message); currentUser = data.user; updateCloudStatus('Sign up successful. Check email confirmation if required.');
}
async function login() {
  if (!supabaseClient) return alert('Please configure supabase-config.js first.');
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: $('authEmail').value, password: $('authPassword').value });
  if (error) return alert(error.message); currentUser = data.user; updateCloudStatus();
}
async function logout() { if (!supabaseClient) return; await supabaseClient.auth.signOut(); currentUser = null; updateCloudStatus('Logged out.'); }
async function uploadToCloud() {
  if (!supabaseClient || !currentUser) return alert('Please configure Supabase and login first.');
  const { error } = await supabaseClient.from('invoice_app_data').upsert({ user_id: currentUser.id, app_key: 'main', data: appData(), updated_at: new Date().toISOString() }, { onConflict: 'user_id,app_key' });
  if (error) return alert(error.message); updateCloudStatus('Local data uploaded to cloud successfully.'); alert('Cloud upload complete!');
}
async function downloadFromCloud() {
  if (!supabaseClient || !currentUser) return alert('Please configure Supabase and login first.');
  const { data, error } = await supabaseClient.from('invoice_app_data').select('data').eq('user_id', currentUser.id).eq('app_key', 'main').single();
  if (error) return alert(error.message); restoreAppData(data.data); updateCloudStatus('Cloud data downloaded successfully.'); alert('Cloud download complete!');
}

document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => showPanel(btn.dataset.panel)));
document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => showPanel(btn.dataset.go)));
fields.forEach(id => $(id).addEventListener('input', updatePreview));
$('addItemBtn').addEventListener('click', () => { items.push({ name: '', qty: 1, price: 0 }); renderItemsEditor(); updatePreview(); });
$('addSavedItemBtn').addEventListener('click', () => addSavedItem(null));
$('saveItemBtn').addEventListener('click', () => {
  const name = $('savedItemName').value.trim(); if (!name) return alert('Please enter item name.');
  saveItemToLibrary(name, $('savedItemQty').value, $('savedItemPrice').value);
  $('savedItemName').value = ''; $('savedItemQty').value = 1; $('savedItemPrice').value = 0;
});
$('logoInput').addEventListener('change', e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { logoData = reader.result; localStorage.setItem('invoice_logo', logoData); updatePreview(); }; reader.readAsDataURL(file); });
$('removeLogoBtn').addEventListener('click', () => { logoData = ''; localStorage.removeItem('invoice_logo'); updatePreview(); });
$('printBtn').addEventListener('click', () => { showPanel('invoicePanel'); setTimeout(() => window.print(), 100); });
$('saveInvoiceBtn').addEventListener('click', () => {
  const totals = calculateTotals();
  const invoice = { items: structuredClone(items), total: totals.total, paidAmountValue: totals.paidAmount, balanceDue: totals.balanceDue, date: getVal('invoiceDate'), ...Object.fromEntries(fields.map(id => [id, $(id).value])) };
  const history = JSON.parse(localStorage.getItem('invoice_history') || '[]'); history.unshift(invoice); localStorage.setItem('invoice_history', JSON.stringify(history));
  alert('Invoice saved successfully!'); updateDashboard();
});
$('resetBtn').addEventListener('click', () => { localStorage.removeItem('invoice_draft'); localStorage.removeItem('invoice_items'); items = [{ name: 'Logo Design Package', qty: 1, price: 25000 }]; loadDraft(); });
$('clearHistoryBtn').addEventListener('click', () => { if (confirm('Clear all saved invoices?')) { localStorage.removeItem('invoice_history'); updateDashboard(); } });
$('signupBtn').addEventListener('click', signUp); $('loginBtn').addEventListener('click', login); $('logoutBtn').addEventListener('click', logout);
$('syncUploadBtn').addEventListener('click', uploadToCloud); $('syncDownloadBtn').addEventListener('click', downloadFromCloud);
initSupabase(); loadDraft();
