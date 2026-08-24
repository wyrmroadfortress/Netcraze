#!/usr/bin/env python3
"""Build public data/stock.json without exposing the supplier to website visitors.

Modes:
1) Supplier API mode: SUPPLIER_API_URL + SUPPLIER_API_TOKEN (+ optional SUPPLIER_API_METHOD/BODY)
2) Generic JSON feed mode: STOCK_FEED_URL (+ optional STOCK_FEED_BEARER)

The parser is intentionally tolerant and accepts common product/warehouse field names.
Keep the supplier endpoint and credentials only in GitHub Secrets. They are never written to the public JSON.
"""
from __future__ import annotations
import json, os, re, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

OUT=Path(__file__).resolve().parents[1]/'data'/'stock.json'
BRAND_RE=re.compile(r'netcraze',re.I)

def fetch_json(url, headers=None, method='GET', body=None):
    data=None if body is None else json.dumps(body).encode()
    h={'Accept':'application/json','User-Agent':'stock-sync/1.0',**(headers or {})}
    if data is not None: h['Content-Type']='application/json'
    req=Request(url,data=data,headers=h,method=method)
    with urlopen(req,timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))

def first(d,*keys,default=None):
    for k in keys:
        if isinstance(d,dict) and d.get(k) not in (None,''): return d[k]
    return default

def unwrap(obj):
    if isinstance(obj,list): return obj
    if isinstance(obj,dict):
        for k in ('items','products','result','data','rows','value'):
            v=obj.get(k)
            if isinstance(v,list): return v
            if isinstance(v,dict):
                u=unwrap(v)
                if u: return u
    return []

def normalize_product(p):
    name=str(first(p,'name','title','productName','itemName','fullName',default='')).strip()
    vendor=str(first(p,'vendor','brand','manufacturer','producer',default='')).strip()
    if not (BRAND_RE.search(name) or BRAND_RE.search(vendor)): return None
    sku=str(first(p,'sku','article','partNumber','vendorCode','code','itemId','id',default='')).strip()
    stocks={}
    raw=first(p,'stocks','warehouses','warehouseStocks','availability','rests','stock',default=[])
    if isinstance(raw,dict):
        if all(isinstance(v,(int,float,str)) for v in raw.values()):
            for c,v in raw.items():
                try: q=int(float(v))
                except: continue
                if q>0: stocks[str(c)]=q
            raw=[]
        else: raw=unwrap(raw)
    if isinstance(raw,list):
        for s in raw:
            if not isinstance(s,dict): continue
            city=str(first(s,'city','warehouseCity','location','warehouseName','name',default='')).strip()
            qty=first(s,'quantity','qty','available','stock','rest','free',default=0)
            try: qty=int(float(qty))
            except: qty=0
            if city and qty>0: stocks[city]=stocks.get(city,0)+qty
    if not stocks:
        city=str(first(p,'city','warehouseCity','location',default='')).strip()
        qty=first(p,'quantity','qty','available','rest','free',default=0)
        try: qty=int(float(qty))
        except: qty=0
        if city and qty>0: stocks[city]=qty
    return {'name':name or f'Netcraze {sku}'.strip(),'sku':sku,'stocks':stocks}

def merge(products):
    by={}
    for p in products:
        n=normalize_product(p)
        if not n: continue
        key=(n['sku'] or n['name']).lower()
        cur=by.setdefault(key,{'name':n['name'],'sku':n['sku'],'stocks':{}})
        for c,q in n['stocks'].items(): cur['stocks'][c]=cur['stocks'].get(c,0)+q
    return sorted(by.values(),key=lambda x:x['name'].lower())

def main():
    feed=os.getenv('STOCK_FEED_URL')
    api=os.getenv('SUPPLIER_API_URL')
    if feed:
        hdr={}
        if os.getenv('STOCK_FEED_BEARER'): hdr['Authorization']='Bearer '+os.environ['STOCK_FEED_BEARER']
        raw=fetch_json(feed,hdr)
    elif api:
        hdr={}
        if os.getenv('SUPPLIER_API_TOKEN'): hdr['Authorization']='Bearer '+os.environ['SUPPLIER_API_TOKEN']
        method=os.getenv('SUPPLIER_API_METHOD','GET').upper()
        body=json.loads(os.getenv('SUPPLIER_API_BODY','null'))
        raw=fetch_json(api,hdr,method,body)
    else:
        print('No feed configured; keeping existing stock.json. Set STOCK_FEED_URL or SUPPLIER_API_URL in GitHub Secrets.',file=sys.stderr)
        return 0
    products=merge(unwrap(raw))
    payload={'updated_at':datetime.now(timezone.utc).isoformat(),'products':products}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Wrote {len(products)} Netcraze products to {OUT}')
    return 0
if __name__=='__main__': raise SystemExit(main())
