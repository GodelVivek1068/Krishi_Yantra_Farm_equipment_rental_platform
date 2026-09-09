import os
import re

frontend_dir = r"c:\Users\Dell\OneDrive\Documents\mega diploma\farm_rental\frontend"
pages_dir = os.path.join(frontend_dir, "pages")

print("=== CHECKING NAVBARS IN PAGES ===")
all_pages = ["../index.html"] + [f for f in sorted(os.listdir(pages_dir)) if f.endswith(".html")]

for f in all_pages:
    p = os.path.normpath(os.path.join(pages_dir, f))
    with open(p, "r", encoding="utf-8", errors="ignore") as fp:
        c = fp.read()
    navs = re.findall(r'<nav[^>]*>(.*?)</nav>', c, re.DOTALL)
    if not navs:
        print(f"{f}: NO NAVBAR")
    else:
        links = re.findall(r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', navs[0], re.DOTALL)
        clean_links = [(l, re.sub(r'<[^>]+>', '', t).strip()) for l, t in links]
        print(f"\n{f}:")
        for l, t in clean_links:
            print(f"   [{t}] -> {l}")
