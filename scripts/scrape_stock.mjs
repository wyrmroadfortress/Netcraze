import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const catalogUrl = process.env.SOURCE_CATALOG_URL;
if (!catalogUrl) {
  console.error('SOURCE_CATALOG_URL is not configured.');
  process.exit(0);
}

const outPath = path.join(process.cwd(), 'data', 'stock.json');
const brandRe = /netcraze/i;
const captured = [];

function text(v) {
  return v == null ? '' : String(v).trim();
}

function num(v) {
  const n = Number(String(v ?? '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function walk(obj, found = []) {
  if (!obj || typeof obj !== 'object') return found;
  if (Array.isArray(obj)) {
    for (const v of obj) walk(v, found);
    return found;
  }
  const blob = JSON.stringify(obj);
  if (brandRe.test(blob)) found.push(obj);
  for (const v of Object.values(obj)) walk(v, found);
  return found;
}

function first(o, keys) {
  for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k];
  return '';
}

function normalize(o) {
  const name = text(first(o, ['name','title','productName','itemName','fullName','model']));
  const brand = text(first(o, ['brand','vendor','manufacturer','producer']));
  if (!brandRe.test(name) && !brandRe.test(brand) && !brandRe.test(JSON.stringify(o))) return null;
  const sku = text(first(o, ['sku','article','partNumber','vendorCode','code','itemId','id']));
  const stocks = {};

  const stockKeys = ['stocks','warehouses','warehouseStocks','availability','rests','stock','remains','balances'];
  for (const key of stockKeys) {
    const raw = o?.[key];
    if (Array.isArray(raw)) {
      for (const s of raw) {
        if (!s || typeof s !== 'object') continue;
        const city = text(first(s, ['city','warehouseCity','location','warehouseName','name','region']));
        const qty = num(first(s, ['quantity','qty','available','stock','rest','free','balance','count']));
        if (city && qty > 0) stocks[city] = (stocks[city] || 0) + qty;
      }
    } else if (raw && typeof raw === 'object') {
      for (const [city, q] of Object.entries(raw)) {
        const qty = num(q);
        if (qty > 0) stocks[text(city)] = (stocks[text(city)] || 0) + qty;
      }
    }
  }

  const city = text(first(o, ['city','warehouseCity','location','warehouseName','region']));
  const qty = num(first(o, ['quantity','qty','available','rest','free','balance','count']));
  if (city && qty > 0) stocks[city] = (stocks[city] || 0) + qty;

  return { name: name || `Netcraze ${sku}`.trim(), sku, stocks };
}

function merge(items) {
  const map = new Map();
  for (const item of items) {
    const n = normalize(item);
    if (!n) continue;
    const key = (n.sku || n.name).toLowerCase();
    const cur = map.get(key) || { name: n.name, sku: n.sku, stocks: {} };
    for (const [city, qty] of Object.entries(n.stocks)) cur.stocks[city] = (cur.stocks[city] || 0) + qty;
    map.set(key, cur);
  }
  return [...map.values()].filter(x => brandRe.test(x.name) || x.sku).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  locale: 'ru-RU'
});
const page = await ctx.newPage();

page.on('response', async (resp) => {
  try {
    const ct = (resp.headers()['content-type'] || '').toLowerCase();
    if (!ct.includes('json')) return;
    const json = await resp.json();
    captured.push(...walk(json));
  } catch {}
});

if (process.env.SOURCE_LOGIN_URL && process.env.SOURCE_LOGIN && process.env.SOURCE_PASSWORD) {
  await page.goto(process.env.SOURCE_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const userSel = 'input[type="email"], input[name*=login i], input[name*=user i], input[type="text"]';
  const passSel = 'input[type="password"]';
  if (await page.locator(userSel).count() && await page.locator(passSel).count()) {
    await page.locator(userSel).first().fill(process.env.SOURCE_LOGIN);
    await page.locator(passSel).first().fill(process.env.SOURCE_PASSWORD);
    const submit = page.getByRole('button', { name: /войти|login|sign in/i }).first();
    if (await submit.count()) await submit.click(); else await page.locator('button[type="submit"], input[type="submit"]').first().click();
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(()=>{});
  }
}

await page.goto(catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(()=>{});

for (let i=0; i<8; i++) {
  await page.mouse.wheel(0, 1800);
  await page.waitForTimeout(500);
}

const bodyText = await page.locator('body').innerText().catch(()=> '');
const htmlProducts = [];
for (const block of bodyText.split(/\n{2,}/)) {
  if (!brandRe.test(block)) continue;
  const lines = block.split('\n').map(s=>s.trim()).filter(Boolean);
  htmlProducts.push({ name: lines.find(x=>brandRe.test(x)) || lines[0] || 'Netcraze' });
}

const products = merge([...captured, ...htmlProducts]);
const payload = { updated_at: new Date().toISOString(), products };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Captured ${captured.length} candidate objects; wrote ${products.length} Netcraze products.`);
await browser.close();
