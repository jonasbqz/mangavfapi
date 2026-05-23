import asyncio
import re
from urllib.parse import quote
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from bs4 import BeautifulSoup
import httpx

app = FastAPI(title="MangaVF Scraper", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://www.mangavf.fr/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9'
}

def limpiar_nombre_manga(slug: str) -> str:
    palabras = slug.replace("-", " ").split()
    nombre = " ".join([p.capitalize() for p in palabras])
    nombre = nombre.replace("Espanol", "Español")
    return quote(nombre)

async def verificar_pagina(client: httpx.AsyncClient, url: str, pagina_num: int):
    try:
        response = await client.head(url, headers=HEADERS, timeout=5.0)
        if response.status_code == 200:
            return {"page": pagina_num, "url": url}
    except Exception:
        pass
    return None

@app.get("/api/v1/manga/extract")
async def extract_manga(url: str = Query(..., description="URL del capítulo")):
    pattern = r"mangavf\.fr/es/([^/]+)/[^/]+-capitulo-(\d+)\.html"
    match = re.search(pattern, url)
    if not match:
        raise HTTPException(status_code=400, detail="URL inválida.")
    
    manga_slug = match.group(1)
    capitulo = match.group(2)
    img_urls = []

    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True) as client:
        try:
            html_res = await client.get(url, timeout=10.0)
            if html_res.status_code == 200:
                soup = BeautifulSoup(html_res.text, 'html.parser')
                for img in soup.find_all('img'):
                    src = img.get('src') or img.get('data-src')
                    if src and ('cdn.mangavf.fr' in src or 'Book-es' in src):
                        if src.startswith('//'): src = 'https:' + src
                        if src not in img_urls: img_urls.append(src)
        except Exception:
            pass

        if not img_urls:
            manga_folder = limpiar_nombre_manga(manga_slug)
            base_cdn = f"https://cdn.mangavf.fr/cdn/Book-es/{manga_folder}/Capitulo%20{capitulo}"
            tareas = []
            for i in range(1, 151):
                img_url = f"{base_cdn}/{i:03d}.jpeg"
                tareas.append(verificar_pagina(client, img_url, i))
            resultados = await asyncio.gather(*tareas)
            paginas_validas = sorted([r for r in resultados if r is not None], key=lambda x: x["page"])
            img_urls = [p["url"] for p in paginas_validas]

    if not img_urls:
        raise HTTPException(status_code=404, detail="No se encontraron imágenes.")
    return {"success": True, "manga": manga_slug.replace("-", " ").title(), "chapter": capitulo, "total_pages": len(img_urls), "pages": img_urls}

@app.get("/api/v1/manga/search")
async def search_manga(q: str = Query(..., min_length=2)):
    search_url = f"https://www.mangavf.fr/es/?s={quote(q)}"
    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True) as client:
        try:
            res = await client.get(search_url, timeout=10.0)
        except Exception:
            raise HTTPException(status_code=503, detail="Error conectando")
    if res.status_code != 200:
        raise HTTPException(status_code=503, detail="Error")
    soup = BeautifulSoup(res.text, 'html.parser')
    resultados = []
    cards = soup.select('div.series-card') or soup.select('article.post') or soup.select('div.result-item')
    for card in cards:
        title_el = card.select_one('h3 a') or card.select_one('h2 a') or card.select_one('a')
        if not title_el: continue
        title = title_el.get_text(strip=True)
        link = title_el.get('href', '')
        cover = ""
        thumb = card.select_one('img')
        if thumb: cover = thumb.get('src') or thumb.get('data-src', '')
        if cover.startswith('//'): cover = 'https:' + cover
        slug_match = re.search(r'mangavf\.fr/es/([^/]+)/?', link)
        slug = slug_match.group(1) if slug_match else ""
        if title and link:
            resultados.append({"title": title, "slug": slug, "url": link, "cover": cover, "status": "Desconocido"})
    return {"success": True, "query": q, "total_results": len(resultados), "results": resultados}

@app.get("/api/v1/manga/chapters")
async def list_chapters(url: str = Query(...)):
    if 'mangavf.fr/es/' not in url:
        raise HTTPException(status_code=400, detail="URL no válida")
    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True) as client:
        try:
            res = await client.get(url, timeout=10.0)
        except Exception:
            raise HTTPException(status_code=503, detail="Error conectando")
    if res.status_code != 200:
        raise HTTPException(status_code=404, detail="Manga no encontrado")
    soup = BeautifulSoup(res.text, 'html.parser')
    title_el = soup.select_one('h1') or soup.select_one('h2')
    manga_title = title_el.get_text(strip=True) if title_el else "Desconocido"
    capitulos = []
    chapter_items = soup.select('a[href*="-capitulo-"]') or soup.select('div.chapter-list a')
    for item in chapter_items:
        chap_url = item.get('href', '')
        chap_title = item.get_text(strip=True)
        num_match = re.search(r'capitulo[- ]?(\d+)', chap_url, re.IGNORECASE) or re.search(r'(\d+)', chap_title)
        chap_num = num_match.group(1) if num_match else "?"
        if chap_url:
            capitulos.append({"number": chap_num, "title": chap_title, "url": chap_url if chap_url.startswith('http') else f"https://www.mangavf.fr{chap_url}"})
    capitulos.sort(key=lambda c: int(c["number"]) if c["number"].isdigit() else 9999)
    return {"success": True, "manga_title": manga_title, "total_chapters": len(capitulos), "chapters": capitulos}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
