import os
import re

frontend_dir = r"c:\Users\Dell\OneDrive\Documents\mega diploma\farm_rental\frontend"
pages_dir = os.path.join(frontend_dir, "pages")

print("--- ANALYZING FRONTEND PAGES (UPDATED REGEX) ---")
html_files = [os.path.join("pages", f) for f in os.listdir(pages_dir) if f.endswith(".html")]
html_files.append("index.html")

for rel_path in sorted(html_files):
    full_path = os.path.join(frontend_dir, rel_path)
    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()

    # find apiCall calls with quotes or backticks
    api_calls = re.findall(r"apiCall\s*\(\s*['\"`]([A-Z]+)['\"`]\s*,\s*['\"`]([^'\"`]+)['\"`]", text)
    # find fetch calls
    fetch_calls = re.findall(r"fetch\s*\(\s*[`'\"]([^`'\"]+)[`'\"]", text)
    # find inline scripts vs external scripts
    scripts = re.findall(r'<script\s+src=["\']([^"\']+)["\']', text)

    # find links to other pages
    links = re.findall(r'href\s*=\s*["\']([^"\'#:]+?)["\']', text)
    html_links = sorted(list(set([l for l in links if l.endswith('.html') or 'pages/' in l])))

    # check if form submits
    forms = re.findall(r'<form\s+[^>]*id=["\']([^"\']+)["\']', text)

    print(f"\n======================================")
    print(f"Page: {rel_path}")
    print(f"  Scripts: {scripts}")
    print(f"  apiCalls ({len(api_calls)}): {api_calls}")
    print(f"  fetchCalls ({len(fetch_calls)}): {fetch_calls}")
    print(f"  Forms: {forms}")
    print(f"  Links to html: {html_links}")
