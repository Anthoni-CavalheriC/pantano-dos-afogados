"""Extrai as fichas do PDF para o site:
- textos corridos (Barlow + relações) como HTML, com caixa (posição) de cada bloco
- camada decorativa (tudo menos esses textos, fundo, moldura e arte) como imagem
- caixas de cada elemento decorativo (para posicionar com CSS sprites)
- arte do personagem com sua posição
Uso: python -I extrair.py <pdf> <pasta img> <arquivo fichas.js>
"""
import sys, io, json, html
import fitz
import numpy as np
from PIL import Image

PDF, OUT_IMG, OUT_JS = sys.argv[1], sys.argv[2], sys.argv[3]
IDS = ["rhiona", "rowan", "muirenn", "cavan", "malik", "sira"]
FUNDO, MOLDURA = 2066, 2085
# u = x + 50 ; v = y. A mediabox é em coordenadas do PDF (y para cima, página de 581 pt):
# para estender 34 pt para BAIXO (onde a arte passa da página), o y vai de -34 a 581.
CAIXA = fitz.Rect(-50, -34, 830, 581)
ZOOM = 3                              # 3 px por ponto na camada decorativa

def eh_corpo(span, tipo):
    f, t, cor = span["font"], span["text"], span["color"]
    x0, y0 = span["bbox"][0], span["bbox"][1]
    if f.startswith("Barlow"):
        return True
    if f.startswith("Wingdings") and t.strip() == "\x8a":
        return True
    if f.startswith("PolymathBold") and cor == 0xFFFFFF:
        return True  # dado dentro do texto
    if tipo == "historia" and f.startswith("Wak") and x0 >= 175 and y0 >= 370:
        return True  # texto das relações
    return False

def eh_pericia(span, tipo):
    """linhas da lista de perícias (nome, dados, +, atributo) — viram texto no site."""
    x0, y0 = span["bbox"][0], span["bbox"][1]
    return (tipo == "ficha" and x0 < 212 and span["bbox"][2] < 214 and 236 < y0 < 560
            and span["font"].startswith(("Wak", "PolymathBold", "OptimaLTPro")))

def extrair_pericias(page):
    sp = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
          if s["text"].strip() and eh_pericia(s, "ficha")]
    linhas = []
    for s in sorted(sp, key=lambda s: (s["bbox"][1] + s["bbox"][3]) / 2):
        cy = (s["bbox"][1] + s["bbox"][3]) / 2
        if linhas and abs(linhas[-1]["cy"] - cy) < 5:
            linhas[-1]["spans"].append(s)
        else:
            linhas.append(dict(cy=cy, spans=[s]))
    itens = []
    for l in linhas:
        ss = sorted(l["spans"], key=lambda s: s["bbox"][0])
        nome = " ".join(s["text"].strip() for s in ss if s["font"].startswith("Wak"))
        dados_ = [s["text"].strip().lstrip("d") for s in ss if s["font"].startswith("PolymathBold")]
        attr = " ".join(s["text"].strip() for s in ss if s["font"].startswith("Optima") and s["text"].strip() != "+")
        if nome and len(dados_) >= 2:
            itens.append(dict(nome=nome, dado=dados_[0], dadoAtributo=dados_[1], atributo=attr))
    if not sp:
        return None
    return dict(itens=itens,
                u0=round(min(s["bbox"][0] for s in sp) + 50, 1), v0=round(min(s["bbox"][1] for s in sp), 1),
                u1=round(max(s["bbox"][2] for s in sp) + 50, 1), v1=round(max(s["bbox"][3] for s in sp), 1))

def extrair_marcos(page):
    """posição do nome principal (Carta Marina) e dos blocos de PV e PD, com o valor máximo."""
    sp = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()]
    caixa = lambda r: dict(u0=round(r[0] + 50, 1), v0=round(r[1], 1), u1=round(r[2] + 50, 1), v1=round(r[3], 1))
    marcos = {}
    nomes = [s for s in sp if s["font"].startswith("CartaMarina")]
    if nomes:
        n = max(nomes, key=lambda s: s["size"])
        marcos["nome"] = caixa(n["bbox"])
    for rotulo in ("PV", "PD"):
        ls = [s for s in sp if s["text"].strip() == rotulo and s["font"].startswith("Wak-Bold") and s["size"] > 14]
        if not ls:
            continue
        l = ls[0]
        cy = (l["bbox"][1] + l["bbox"][3]) / 2
        vals = [s for s in sp if s["font"].startswith("Wak-Medium") and s["text"].strip().isdigit()
                and s["bbox"][0] > l["bbox"][0] and abs((s["bbox"][1] + s["bbox"][3]) / 2 - cy) < 10]
        if not vals:
            continue
        v = min(vals, key=lambda s: s["bbox"][0])
        marcos[rotulo.lower()] = dict(rotulo=caixa(l["bbox"]), valor=caixa(v["bbox"]), max=int(v["text"].strip()))
    # barra de ímpeto (executores): segmentos arredondados à direita do título "ÍMPETO"
    tit = [s for s in sp if s["font"].startswith("Wak-Bold") and s["text"].strip().upper() in ("ÍMPETO", "ÍMPETO")]
    if tit:
        t = tit[0]
        y0, y1, x1 = t["bbox"][1] - 6, t["bbox"][3] + 6, t["bbox"][2]
        segs = sorted((dr["rect"] for dr in page.get_drawings()
                       if dr.get("fill") and dr["rect"].y0 >= y0 and dr["rect"].y1 <= y1 and dr["rect"].x0 >= x1 - 2
                       and 12 < dr["rect"].width < 24 and 5 < dr["rect"].height < 12), key=lambda r: r.x0)
        if segs:
            marcos["impeto"] = dict(titulo=caixa(t["bbox"]), segmentos=[caixa(tuple(r)) for r in segs])
    return marcos

def spans_de_corpo(l, tipo):
    """spans de texto corrido de uma linha. Dados (Polymath) contam quando estão numa
    linha que tem texto em Barlow (ícone de dado no meio da frase), qualquer que seja a cor."""
    sp = [s for s in l["spans"] if s["text"].strip()]
    tem_barlow = any(s["font"].startswith("Barlow") for s in sp)
    return [s for s in sp if eh_corpo(s, tipo) or (tem_barlow and s["font"].startswith("PolymathBold"))]

def span_html(s):
    f, t = s["font"], s["text"]
    if f.startswith("Wingdings"):
        return '<span class="marca">◆</span>'
    if f.startswith("PolymathBold"):
        n = t.strip().lstrip("d")
        return f'<span class="dado d{n}"><span>{n}</span></span>'
    txt = html.escape(t.replace("\n", " "))
    if f.startswith("Wak"):
        cls = "wak b" if "Bold" in f else "wak"
        return f'<span class="{cls}">{txt}</span>'
    if "Black" in f:
        txt = f"<b>{txt}</b>"
    elif "Bold" in f:
        txt = f'<b class="b7">{txt}</b>'
    if "Italic" in f:
        txt = f"<i>{txt}</i>"
    return txt

def extrair_textos(page, tipo):
    linhas = []  # cada linha: dict(x0,y0,x1,y1,size,spans)
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            sp = spans_de_corpo(l, tipo)
            if not sp:
                continue
            # tamanho de referência da linha = maior fonte de texto (ignora dados/marcas)
            tams = [s["size"] for s in sp if not s["font"].startswith(("Polymath", "Wingdings"))] or [10]
            linhas.append(dict(
                x0=min(s["bbox"][0] for s in sp), y0=min(s["bbox"][1] for s in sp),
                x1=max(s["bbox"][2] for s in sp), y1=max(s["bbox"][3] for s in sp),
                size=max(tams), spans=sp,
                marca=sp[0]["font"].startswith("Wingdings"),
            ))
    # junta linhas da mesma "coluna" em blocos
    linhas.sort(key=lambda l: (round(l["y0"]), l["x0"]))
    blocos = []
    for l in linhas:
        alvo = None
        # linhas das relações ficam sozinhas: cada uma alinhada ao nome e aos círculos
        eh_wak = any(s["font"].startswith("Wak") for s in l["spans"])
        for b in ([] if eh_wak else reversed(blocos)):
            if any(s["font"].startswith("Wak") for s in b["linhas"][-1]["spans"]):
                continue
            ult = b["linhas"][-1]
            gap = l["y0"] - ult["y1"]
            mesma_coluna = abs(l["x0"] - b["x0"]) < 12 or (l["x0"] > b["x0"] and l["x0"] - b["x0"] < 12)
            if mesma_coluna and -2 < gap < max(l["size"], ult["size"]) * 1.25 and abs(l["size"] - ult["size"]) < 0.5:
                alvo = b
                break
        if alvo is None:
            blocos.append(dict(x0=l["x0"], linhas=[l]))
        else:
            alvo["linhas"].append(l)
    saida = []
    for b in blocos:
        ls = b["linhas"]
        size = max(l["size"] for l in ls)
        partes, atual = [], []
        prev = None
        for l in ls:
            # linhas normais quase se encostam (gap ~0); parágrafos têm ~5 pt a mais
            novo_par = prev is None or l["marca"] or (l["y0"] - prev["y1"]) > size * 0.25
            if novo_par and atual:
                partes.append(atual); atual = []
            atual.append(l); prev = l
        if atual:
            partes.append(atual)
        htmlp = []
        for p in partes:
            txt = ""
            for l in p:
                pedaco = ""
                ant = None
                for s in l["spans"]:
                    # espaço entre pedaços separados na página (ex.: "após" + "rolar os dados")
                    if ant is not None and s["bbox"][0] - ant["bbox"][2] > 1.2 \
                            and not ant["text"].endswith(" ") and not s["text"].startswith(" "):
                        pedaco += " "
                    pedaco += span_html(s)
                    ant = s
                if txt and not txt.endswith(" "):
                    txt += " "
                txt += pedaco
            cls = ' class="item"' if p[0]["marca"] else ""
            htmlp.append(f"<p{cls}>{txt.strip()}</p>")
        saida.append(dict(
            u0=round(min(l["x0"] for l in ls) + 50, 1), v0=round(min(l["y0"] for l in ls), 1),
            u1=round(max(l["x1"] for l in ls) + 50, 1), v1=round(max(l["y1"] for l in ls), 1),
            size=size, wak=any(s["font"].startswith("Wak") for l in ls for s in l["spans"]),
            html="".join(htmlp),
        ))
    return saida

def componentes(mask, raio):
    """rotula regiões conectadas de uma máscara (após dilatação). Retorna caixas."""
    m = mask.copy()
    for _ in range(raio):
        d = m.copy()
        d[1:, :] |= m[:-1, :]; d[:-1, :] |= m[1:, :]
        d[:, 1:] |= m[:, :-1]; d[:, :-1] |= m[:, 1:]
        m = d
    h, w = m.shape
    rot = np.zeros((h, w), dtype=np.int32)
    caixas = []
    n = 0
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        if rot[y, x]:
            continue
        n += 1
        pilha = [(y, x)]; rot[y, x] = n
        y0 = y1 = y; x0 = x1 = x
        while pilha:
            cy, cx = pilha.pop()
            y0 = min(y0, cy); y1 = max(y1, cy); x0 = min(x0, cx); x1 = max(x1, cx)
            for ny, nx in ((cy-1, cx), (cy+1, cx), (cy, cx-1), (cy, cx+1)):
                if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not rot[ny, nx]:
                    rot[ny, nx] = n; pilha.append((ny, nx))
        # encolhe de volta pela dilatação, usando a máscara original
        sub = mask[y0:y1+1, x0:x1+1] & (rot[y0:y1+1, x0:x1+1] == n)
        yy, xx = np.nonzero(sub)
        if len(yy) == 0:
            continue
        # folga de 2 pt para não cortar bordas finas (letras pequenas, antialias)
        caixas.append([max(0, int(x0 + xx.min()) - 2), max(0, int(y0 + yy.min()) - 2),
                       min(w, int(x0 + xx.max()) + 3), min(h, int(y0 + yy.max()) + 3)])
    return caixas

dados = {}
doc_base = fitz.open(PDF)
for i, pid in enumerate(IDS):
    dados[pid] = {}
    for k, tipo in ((0, "ficha"), (1, "historia")):
        n = i * 2 + k
        doc = fitz.open(PDF)
        page = doc[n]
        blocos = extrair_textos(page, tipo)
        pericias = extrair_pericias(page) if tipo == "ficha" else None
        marcos = extrair_marcos(page) if tipo == "ficha" else None

        # arte do personagem (só na ficha)
        arte = None
        for info in page.get_images(full=True):
            xref, smask = info[0], info[1]
            if xref in (FUNDO, MOLDURA) or info[2] < 400 or info[3] < 400:
                continue
            r = page.get_image_rects(xref)[0]
            base = fitz.Pixmap(doc, xref)
            if base.n - base.alpha >= 4:
                base = fitz.Pixmap(fitz.csRGB, base)
            if smask:
                base = fitz.Pixmap(base, fitz.Pixmap(doc, smask))
            im = Image.open(io.BytesIO(base.tobytes("png"))).convert("RGBA")
            im.thumbnail((1000, 1300))
            im.save(f"{OUT_IMG}/{pid}-arte.webp", quality=86, method=4)
            arte = dict(src=f"img/{pid}-arte.webp", u0=round(r.x0 + 50, 1), v0=round(r.y0, 1), u1=round(r.x1 + 50, 1), v1=round(r.y1, 1))
            page.delete_image(xref)

        # camada decorativa: remove fundo, moldura e os textos corridos
        for x in (FUNDO, MOLDURA):
            try:
                page.delete_image(x)
            except Exception:
                pass
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                extra = [x for x in l["spans"] if x["text"].strip() and eh_pericia(x, tipo)]
                for s in spans_de_corpo(l, tipo) + extra:
                    if True:
                        r = fitz.Rect(s["bbox"])
                        r.y0 += r.height * 0.2; r.y1 -= r.height * 0.2
                        page.add_redact_annot(r)
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                              graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                              text=fitz.PDF_REDACT_TEXT_REMOVE)
        page.set_mediabox(CAIXA)
        pm = page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), alpha=True)
        im = Image.open(io.BytesIO(pm.tobytes("png"))).convert("RGBA")
        im.save(f"{OUT_IMG}/{pid}-{tipo}-deco.webp", quality=88, method=4)

        # elementos decorativos (regiões conectadas), em pontos
        alpha = np.array(im.split()[-1])
        h, w = alpha.shape
        pequeno = alpha[: h - h % ZOOM, : w - w % ZOOM].reshape(h // ZOOM, ZOOM, w // ZOOM, ZOOM).max(axis=(1, 3)) > 25
        caixas = [c for c in componentes(pequeno, 4) if (c[2] - c[0]) * (c[3] - c[1]) >= 12]

        dados[pid][tipo] = dict(deco=f"img/{pid}-{tipo}-deco.webp", elementos=caixas, textos=blocos, arte=arte,
                                pericias=pericias, marcos=marcos)
        print(pid, tipo, "textos:", len(blocos), "elementos:", len(caixas), "arte:", bool(arte))
        # imagem de conferência: caixas de elementos (verde) e textos (vermelho) sobre a camada
        from PIL import ImageDraw
        dbg = Image.new("RGBA", im.size, (20, 26, 24, 255)); dbg.alpha_composite(im)
        dr = ImageDraw.Draw(dbg)
        for c in caixas:
            dr.rectangle([c[0]*ZOOM, c[1]*ZOOM, c[2]*ZOOM, c[3]*ZOOM], outline=(0, 255, 0, 255), width=3)
        for t in blocos:
            dr.rectangle([t["u0"]*ZOOM, t["v0"]*ZOOM, t["u1"]*ZOOM, t["v1"]*ZOOM], outline=(255, 60, 60, 255), width=3)
        dbg.convert("RGB").resize((880, 615)).save(sys.argv[4] + f"/{pid}-{tipo}.jpg")

with open(OUT_JS, "w", encoding="utf-8") as f:
    f.write("// Gerado a partir do PDF das fichas (não editar à mão).\n")
    f.write("// Coordenadas em pontos da página: u = x + 50, v = y (caixa de 880 × 615).\n")
    f.write("window.FICHAS = ")
    json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
