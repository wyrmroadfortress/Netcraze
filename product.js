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
  const stock=await stockRes.json();const specs=await specRes.json();
  const p=stock.products.find(x=>String(x.sku)===String(sku));const s=specs[String(sku)];
  if(!p){$('#productView').innerHTML='<div class="not-found">Товар не найден.</div>';return}
  document.title=`${p.name} — характеристики`;
  const stockEntries=Object.entries(p.stocks||{}).filter(([,v])=>Number(v)>0);
  const stockPills=stockEntries.map(([c,v])=>`<div class="availability-pill"><span>${esc(c)}</span><strong>${Number(v)} шт.</strong></div>`).join('');
  const specRows=s?Object.entries(s.specs||{}).map(([k,v])=>`<div class="spec-row"><div class="spec-key">${esc(k)}</div><div class="spec-value">${esc(v)}</div></div>`).join(''):'';
  const url=officialUrl(p.name);
  $('#productView').innerHTML=`
    <div class="product-detail-head">
      <div class="detail-main">
        <div class="eyebrow">${esc(s?.type||'Оборудование Netcraze')}</div>
        <h1 class="detail-title">${esc(p.name)}</h1>
        <div class="detail-sku">Артикул: ${esc(p.sku||'—')}</div>
        <p class="detail-description">${esc(s?.description||'Характеристики модели будут добавлены позже.')}</p>
        <div class="detail-actions"><a class="official-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Открыть на официальном сайте <span>↗</span></a></div>
      </div>
      <div class="detail-buybox">
        <div class="detail-price">${money(p.price,p.currency)}</div>
        <div class="availability-summary"><span class="availability-dot"></span><strong>В наличии</strong><span>${total(p)} шт. всего</span></div>
        <div class="availability-list">${stockPills||'<div class="availability-empty">Сейчас нет доступных остатков</div>'}</div>
      </div>
    </div>
    <section class="spec-section">
      <div class="section-heading"><div><div class="section-kicker">Технические данные</div><h2>Характеристики</h2></div><div class="section-total">${total(p)} шт. доступно</div></div>
      <div class="spec-table">${specRows||'<div class="spec-row"><div class="spec-key">Данные</div><div class="spec-value">Уточняются</div></div>'}</div>
    </section>`;
}
init().catch(e=>{$('#productView').innerHTML='<div class="not-found">Не удалось загрузить карточку товара.</div>';console.error(e)});
