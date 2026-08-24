#!/usr/bin/env python3
from __future__ import annotations
import io, json, os, re, shutil, sys, zipfile
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
STOCK = ROOT / 'data' / 'stock.json'
OUT_JSON = ROOT / 'data' / 'images.json'
IMG_ROOT = ROOT / 'images' / 'products'
BASE = 'https://partners.netcraze.ru'
LIST = BASE + '/marketing/devices?page={}'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36'

def get(url: str) -> bytes:
    req = Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    with urlopen(req, timeout=90) as r:
        return r.read()

def slug_model(name: str) -> str:
    m = re.search(r'\((N(?:C|AP|PA)-\d+)\)', name, re.I)
    return (m.group(1) if m else name).upper()

def discover() -> dict[str, int]:
    found = {}
    pat = re.compile(r'href=["\'](?:https?://partners\.netcraze\.ru)?/marketing/devices/(\d+)["\'][^>]*>(.*?)</a>', re.I | re.S)
    for page in range(1, 8):
        try:
            html = get(LIST.format(page)).decode('utf-8', 'ignore')
        except Exception as e:
            print('list page failed', page, e, file=sys.stderr)
            continue
        for did, title in pat.findall(html):
            text = re.sub('<[^>]+>', ' ', title)
            text = re.sub(r'\s+', ' ', text).strip()
            mm = re.search(r'((?:NC|NAP|NPA)-\d+)', text, re.I)
            if mm:
                found[mm.group(1).upper()] = int(did)
    return found

def archive_url(device_id: int) -> str:
    return f'{BASE}/marketing/devices/download/{device_id}'

def safe_ext(name: str) -> str | None:
    ext = Path(name).suffix.lower()
    if ext in {'.jpg','.jpeg','.png','.webp'}:
        return '.jpg' if ext == '.jpeg' else ext
    return None

def extract_images(blob: bytes, target: Path, limit=6) -> list[str]:
    target.mkdir(parents=True, exist_ok=True)
    for p in target.iterdir():
        if p.is_file(): p.unlink()
    files = []
    try:
        z = zipfile.ZipFile(io.BytesIO(blob))
    except zipfile.BadZipFile:
        return files
    candidates = []
    for info in z.infolist():
        if info.is_dir(): continue
        ext = safe_ext(info.filename)
        if not ext: continue
        low = info.filename.lower()
        score = 0
        if any(k in low for k in ('main','front','view1','view_1','1.')): score -= 20
        if any(k in low for k in ('box','package','label','sticker','qr')): score += 20
        score += len(Path(info.filename).parts)
        candidates.append((score, info, ext))
    candidates.sort(key=lambda x: (x[0], x[1].filename.lower()))
    seen = set()
    for _, info, ext in candidates:
        if len(files) >= limit: break
        raw = z.read(info)
        key = (len(raw), raw[:64])
        if key in seen: continue
        seen.add(key)
        out = target / f'{len(files)+1}{ext}'
        out.write_bytes(raw)
        files.append(out.name)
    return files

def main():
    stock = json.loads(STOCK.read_text(encoding='utf-8'))
    devices = discover()
    print('discovered', len(devices), 'official device media pages')
    result = {}
    for p in stock.get('products', []):
        model = slug_model(p.get('name',''))
        did = devices.get(model)
        if not did:
            print('no official media page:', model)
            continue
        try:
            blob = get(archive_url(did))
            folder = IMG_ROOT / model.lower()
            names = extract_images(blob, folder)
            if names:
                result[str(p.get('sku',''))] = [f'images/products/{model.lower()}/{n}' for n in names]
                print(model, len(names), 'images')
            else:
                print('archive had no supported images:', model)
        except Exception as e:
            print('image import failed:', model, e, file=sys.stderr)
    OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print('wrote', OUT_JSON, 'for', len(result), 'products')

if __name__ == '__main__':
    main()
