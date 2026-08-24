const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const money=(v,c='RUB')=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:c||'RUB',maximumFractionDigits:0}).format(Number(v)||0);
const total=p=>Object.values(p.stocks||{}).reduce((a,b)=>a+(Number(b)||0),0);
function gallery(images,name){
  if(!images?.length) return `<div class="product-gallery empty-gallery"><div class="gallery-placeholder"><div class="gallery-placeholder-icon">⌁</div><div>Фотографии загружаются</div></div></div>`;
  const thumbs=images.map((src,i)=>`<button class="gallery-thumb${i===0?' active':''}" type="button" data-src="${esc(src)}"><img src="${esc(src)}" alt="${esc(name)} — вид ${i+1}" loading="lazy"></button>`).join('');
  return `<div class="product-gallery"><div class="gallery-main"><img id="mainProductImage" src="${esc(images[0])}" alt="${esc(name)}"></div>${images.length>1?`<div class="gallery-thumbs">${thumbs}</div>`:''}</div>`;
}
function bindGallery(){document.querySelectorAll('.gallery-thumb').forEach(btn=>btn.addEventListener('click',()=>{const img=$('#mainProductImage');if(!img)return;img.src=btn.dataset.src;document.querySelectorAll('.gallery-thumb').forEach(x=>x.classList.remove('active'));btn.classList.add('active')}))}
async function init(){
  const sku=new URLSearchParams(location.search).get('sku');
  const [stockRes,specRes,imgRes]=await Promise.all([
    fetch(`data/stock.json?v=${Date.now()}`,{cache:'no-store'}),
    fetch(`data/specs.json?v=${Date.now()}`,{cache:'no-store'}),
    fetch(`data/images.json?v=${Date.now()}`,{cache:'no-store'}).catch(()=>null)
  ]);
  const stock=await stockRes.json();const specs=await specRes.json();const images=imgRes&&imgRes.ok?await imgRes.json():{};
  const p=stock.products.find(x=>String(x.sku)===String(sku));const s=specs[String(sku)];
  if(!p){$('#productView').innerHTML='<div class="not-found">Товар не найден.</div>';return}
  document.title=`${p.name} — характеристики`;
  const rows=Object.entries(p.stocks||{}).filter(([,v])=>Number(v)>0).map(([c,v])=>`<div class="stock-row"><div class="city">${esc(c)}</div><div class="qty">${Number(v)} шт.</div></div>`).join('');
  const specRows=s?Object.entries(s.specs||{}).map(([k,v])=>`<div class="spec-row"><div class="spec-key">${esc(k)}</div><div class="spec-value">${esc(v)}</div></div>`).join(''):'';
  $('#productView').innerHTML=`<div class="detail-hero-grid">${gallery(images[String(sku)]||[],p.name)}<div class="product-detail-head"><div><div class="eyebrow">${esc(s?.type||'Оборудование Netcraze')}</div><h1 class="detail-title">${esc(p.name)}</h1><div class="detail-sku">Артикул: ${esc(p.sku||'—')}</div><p class="detail-description">${esc(s?.description||'Характеристики модели будут добавлены позже.')}</p></div><div class="detail-price">${money(p.price,p.currency)}</div></div></div><div class="detail-grid"><section><h2>Характеристики</h2><div class="spec-table">${specRows||'<div class="spec-row"><div class="spec-key">Данные</div><div class="spec-value">Уточняются</div></div>'}</div></section><aside><div class="stock-card"><div class="stock-card-title">Наличие</div>${rows||'<div class="stock-row"><div class="city">Нет доступных остатков</div></div>'}<div class="stock-total"><div class="label">Всего доступно</div><div class="num">${total(p)} <small>шт.</small></div></div></div></aside></div>`;
  bindGallery();
}
init().catch(e=>{$('#productView').innerHTML='<div class="not-found">Не удалось загрузить карточку товара.</div>';console.error(e)});
