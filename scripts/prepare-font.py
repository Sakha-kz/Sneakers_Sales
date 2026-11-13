from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from pathlib import Path

root = Path(__file__).resolve().parents[1]
font = TTFont(root / 'public/fonts/Montserrat.ttf')
required = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzӘәҒғҚқҢңӨөҰұҮүҺһІіАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
assert all(ord(c) in font.getBestCmap() for c in required), 'Missing required glyphs'
font.flavor = 'woff2'
font.save(root / 'public/fonts/Montserrat.woff2')
bold = instantiateVariableFont(font, {'wght': 900}, inplace=False)
glyphs = bold.getGlyphSet()
cmap = bold.getBestCmap()
paths = []
x = 0
for char in 'NORTHX':
    glyph = glyphs[cmap[ord(char)]]
    pen = SVGPathPen(glyphs)
    glyph.draw(pen)
    paths.append(f'<path transform="translate({x},0)" d="{pen.getCommands()}"/>')
    x += glyph.width
scale = 510 / x
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="768" height="224" viewBox="0 0 768 224">
<g fill="#22262b">
<path d="M32 147 87 47 122 104 151 59 200 147H32Z" fill="none" stroke="#22262b" stroke-width="9"/>
<g transform="translate(228,143) scale({scale},-{scale})">{''.join(paths)}</g>
<text x="233" y="184" font-family="Arial,Helvetica,sans-serif" font-size="18" letter-spacing="5">SNEAKERS &amp; FOOTWEAR</text>
</g></svg>'''
(root / 'public/northx-box-label.svg').write_text(svg, encoding='utf-8')
print('Verified Latin, Russian and Kazakh glyphs; generated WOFF2 and outlined NORTHX wordmark.')
