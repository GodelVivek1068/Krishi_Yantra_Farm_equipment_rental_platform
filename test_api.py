import urllib.request
import json

base = "http://localhost:5000/api"

endpoints = [
    ("GET", "/health"),
    ("GET", "/equipment/?limit=5"),
    ("GET", "/equipment/alternatives"),
    ("GET", "/kamgar/profiles"),
    ("GET", "/fertilizer/products"),
    ("GET", "/transport/?limit=5"),
    ("GET", "/contact/"),
    ("GET", "/admin/commission"),
    ("GET", "/admin/dashboard"),
    ("GET", "/fertilizer/notifications?limit=10"),
    ("GET", "/fertilizer/supplier/analytics"),
]

for method, ep in endpoints:
    url = base + ep
    try:
        req = urllib.request.Request(url, method=method)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode('utf-8')
            print(f"[OK] {method} {ep} -> {resp.status} (len {len(data)})")
    except urllib.error.HTTPError as e:
        print(f"[HTTP {e.code}] {method} {ep} -> {e.read().decode('utf-8')[:100]}")
    except Exception as e:
        print(f"[ERR] {method} {ep} -> Error: {e}")
