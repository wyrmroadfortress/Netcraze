const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const money=(v,c='RUB')=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:c||'RUB',maximumFractionDigits:0}).format(Number(v)||0);
const total=p=>Object.values(p.stocks||{}).reduce((a,b)=>a+(Number(b)||0),0);

function officialUrl(name){
  const title=String(name||'').replace(/^Netcraze\s+/i,'').replace(/\s*\([^)]*\)\s*$/,'').trim();
  const slug=title.toLowerCase().replace(/\+/g,' plus ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return slug?`https://netcraze.ru/ru/netcraze-${slug}`:'';
}

function modelFromName(name){
  const m=String(name||'').match(/\(([^)]+)\)\s*$/);
  return m?m[1]:'';
}

function inferType(name){
  const n=String(name||'').toLowerCase();
  if(n.includes('poe')||n.includes('adapter'))return 'Сетевой аксессуар';
  if(n.includes('orbiter')||n.includes('stellar'))return 'Mesh Wi-Fi оборудование';
  if(n.includes('4g')||n.includes('lte'))return '4G-интернет-центр';
  if(n.includes('dsl'))return 'DSL-интернет-центр';
  return 'Интернет-центр Netcraze';
}

function normalizeEmbeddedSpecs(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  if(value.specs&&typeof value.specs==='object'&&!Array.isArray(value.specs))return value.specs;
  return value;
}

async function loadJson(url,fallback){
  try{
    const r=await fetch(`${url}?v=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`${url}: ${r.status}`);
    return await r.json();
  }catch(e){
    console.warn(e);
    return fallback;
  }
}

async function init(){
  const sku=new URLSearchParams(location.search).get('sku');
  const [stock,specs]=await Promise.all([
    loadJson('data/stock.json',{products:[]}),
    loadJson('data/specs.json',{})
  ]);

  const p=(stock.products||[]).find(x=>String(x.sku)===String(sku));
  if(!p){
    $('#productView').innerHTML='<div class="pd-notfound">Товар не найден или сейчас недоступен.</div>';
    return;
  }

  const saved=specs[String(sku)]||{};
  const embedded=normalizeEmbeddedSpecs(p.specs);
  const specMap={...(saved.specs||{}),...embedded};
  const model=p.model||saved.model||modelFromName(p.name);
  const type=p.type||saved.type||inferType(p.name);
  const description=p.description||saved.description||'Актуальная модель Netcraze. Цена и складские остатки обновляются автоматически.';
  const explicitOfficial=p.official_url||saved.official_url||'';
  const official=explicitOfficial||(Object.keys(saved).length?officialUrl(p.name):'');

  document.title=`${p.name} — характеристики`;
  const t=total(p);
  const stockRows=Object.entries(p.stocks||{})
    .filter(([,v])=>Number(v)>0)
    .sort((a,b)=>Number(b[1])-Number(a[1]))
    .map(([c,v])=>`<div class="pd-stock-row"><span>${esc(c)}</span><strong>${Number(v)} шт.</strong></div>`)
    .join('');

  const baseRows={};
  if(model&&!('Модель' in specMap))baseRows['Модель']=model;
  const allSpecs={...baseRows,...specMap};
  const specRows=Object.entries(allSpecs)
    .map(([k,v])=>`<div class="pd-row"><div class="pd-key">${esc(k)}</div><div class="pd-value">${esc(v)}</div></div>`)
    .join('');

  const officialLink=official
    ? `<a class="pd-official" href="${esc(official)}" target="_blank" rel="noopener noreferrer">Открыть на официальном сайте <span>↗</span></a>`
    : '';

  const specsBlock=specRows
    ? specRows
    : '<div class="pd-row"><div class="pd-key">Характеристики</div><div class="pd-value">Подробные данные для этой модели пока не получены</div></div>';

  $('#productView').innerHTML=`<div class="pd-head"><div class="pd-main"><div class="pd-kicker">${esc(type)}</div><h1 class="pd-title">${esc(p.name)}</h1><div class="pd-sku">Артикул: ${esc(p.sku||'—')}</div><p class="pd-desc">${esc(description)}</p>${officialLink}</div><aside class="pd-buy"><div class="pd-price">${money(p.price,p.currency)}</div><div class="pd-status"><span class="pd-status-dot"></span><strong>${t>0?'В наличии':'Нет в наличии'}</strong>${t>0?`<span class="pd-status-total">${t} шт. всего</span>`:''}</div><div class="pd-stock-list">${stockRows||'<div class="pd-stock-empty">Сейчас нет доступных остатков</div>'}</div></aside></div><section class="pd-specs"><div class="pd-spec-head"><div class="pd-spec-kicker">Технические данные</div><h2 class="pd-spec-title">Характеристики</h2></div><div class="pd-table">${specsBlock}</div></section>`;
}

init().catch(e=>{
  $('#productView').innerHTML='<div class="pd-notfound">Не удалось загрузить карточку товара.</div>';
  console.error(e);
});
