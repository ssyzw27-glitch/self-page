from pathlib import Path
p=Path("index.html")
s=p.read_text(encoding="utf-8")
s=s.replace('<section class="hero wrap">','<section class="hero hero-text-only wrap">',1)
start=s.index('<div class="hero-visual hero-board">')
end=s.index('</div>',start)+len('</div>')
s=s[:start]+s[end:]
p.write_text(s,encoding="utf-8")
