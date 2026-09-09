import os
import re

frontend_dir = r"c:\Users\Dell\OneDrive\Documents\mega diploma\farm_rental\frontend"
pages_dir = os.path.join(frontend_dir, "pages")

pages = [f for f in sorted(os.listdir(pages_dir)) if f.endswith(".html")]
pages.append("../index.html")

print(f"Total HTML pages: {len(pages)}")

for p in pages:
    fpath = os.path.normpath(os.path.join(pages_dir, p))
    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    
    # check mock or sample data
    has_mock = bool(re.search(r'const\s+(?:MOCK_|SAMPLE_|mock|dummy|fake)', content, re.I))
    
    # check api calls
    api_calls = re.findall(r"apiCall\s*\(\s*['\"`]([A-Z]+)['\"`]\s*,\s*['\"`]([^'\"`]+)['\"`]", content)
    
    # check any other fetch
    fetches = re.findall(r"fetch\s*\(", content)
    
    # check script tags
    scripts = re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', content)
    
    print(f"\n[{p}]")
    print(f"  scripts: {scripts}")
    print(f"  apiCalls: {len(api_calls)} -> {api_calls[:3]}")
    if has_mock:
        print(f"  WARNING: Has mock/sample data pattern!")
    if len(api_calls) == 0 and len(fetches) == 0 and not p.endswith("index.html"):
        print(f"  NOTICE: 0 direct api calls in html body")
