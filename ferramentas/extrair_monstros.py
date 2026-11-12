"""Extrai as artes dos monstros (Afogado e Aughisk) do PDF da missão.
Uso: python -I ferramentas/extrair_monstros.py <pdf> <pasta img>"""
import sys, io
import fitz
from PIL import Image

pdf, out = sys.argv[1], sys.argv[2]
d = fitz.open(pdf)
ARTES = {"afogado": (0, 90), "aughisk": (1, 206)}   # (página, xref da imagem)
for nome, (pag, xref) in ARTES.items():
    info = next(i for i in d[pag].get_images(full=True) if i[0] == xref)
    base = fitz.Pixmap(d, xref)
    if base.n - base.alpha >= 4:
        base = fitz.Pixmap(fitz.csRGB, base)
    if info[1]:
        base = fitz.Pixmap(base, fitz.Pixmap(d, info[1]))
    im = Image.open(io.BytesIO(base.tobytes("png"))).convert("RGBA")
    im = im.crop(im.getbbox())          # corta a transparência em volta
    im.thumbnail((1100, 1100))
    im.save(f"{out}/{nome}-arte.webp", quality=86, method=4)
    print(nome, im.size)
