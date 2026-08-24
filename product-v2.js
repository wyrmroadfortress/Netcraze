const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const money=(v,c='RUB')=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:c||'RUB',maximumFractionDigits:0}).format(Number(v)||0);
const total=p=>Object.values(p.stocks||{}).reduce((a,b)=>a+(Number(b)||0),0);
function officialUrl(name){const title=String(name||'').replace(/^Netcraze\s+/i,'').replace(/\s*\([^)]*\)\s*$/,'').trim();const slug=title.toLowerCase().replace(/\+/g,' plus ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');return `https://netcraze.ru/ru/netcraze-${slug}`}
async function init(){
  const sku=new URLSearchParams(location.search).get('sku');
  const [stockRes,specRes]=await Promise.all([
    fetch(`data/stock.json?v=${Date.now()}`,{cache:'no-store'}),
    fetch(`data/specs.json?v=${Date.now()}`,{cache:'no-store'})
  ]);
  const stock=await stockRes.json(); const specs=await specRes.json();
  const p=stock.products.find(x=>String(x.sku)===String(sku)); const s=specs[String(sku)];
  if(!p){$('#productView').innerHTML='<div class="pd-notfound">Товар не найден.</div>';return}
  document.title=`${p.name} — характеристики`;
  const t=total(p);
  const stockRows=Object.entries(p.stocks||{}).filter(([,v])=>Number(v)>0).map(([c,v])=>`<div class="pd-stock-row"><span>${esc(c)}</span><strong>${Number(v)} шт.</strong></div>`).join('');
  const specRows=s?Object.entries(s.specs||{}).map(([k,v])=>`<div class="pd-row"><div class="pd-key">${esc(k)}</div><div class="pd-value">${esc(v)}</div></div>`).join(''):'';
  $('#productView').innerHTML=`<div class="pd-head"><div class="pd-main"><div class="pd-kicker">${esc(s?.type||'Оборудование Netcraze')}</div><h1 class="pd-title">${esc(p.name)}</h1><div class="pd-sku">Артикул: ${esc(p.sku||'—')}</div><p class="pd-desc">${esc(s?.description||'Характеристики модели будут добавлены позже.')}</p><a class="pd-official" href="${esc(officialUrl(p.name))}" target="_blank" rel="noopener noreferrer">Открыть на официальном сайте <span>↗</span></a></div><aside class="pd-buy"><div class="pd-price">${money(p.price,p.currency)}</div><div class="pd-status"><span class="pd-status-dot"></span><strong>${t>0?'В наличии':'Нет в наличии'}</strong>${t>0?`<span class="pd-status-total">${t} шт. всего</span>`:''}</div><div class="pd-stock-list">${stockRows||'<div class="pd-stock-empty">Сейчас нет доступных остатков</div>'}</div></aside></div><section class="pd-specs"><div class="pd-spec-head"><div class="pd-spec-kicker">Технические данные</div><h2 class="pd-spec-title">Характеристики</h2></div><div class="pd-table">${specRows||'<div class="pd-row"><div class="pd-key">Данные</div><div class="pd-value">Уточняются</div></div>'}</div></section>`;
}
init().catch(e=>{$('#productView').innerHTML='<div class="pd-notfound">Не удалось загрузить карточку товара.</div>';console.error(e)});
