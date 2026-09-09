import urllib.request
import json
import sys

base = "http://localhost:5000"

test_paths = [
    # Static & root
    ("/", 200),
    ("/index.html", 200),
    ("/favicon.svg", 200),
    ("/css/main.css", 200),
    ("/js/main.js", 200),

    # Backend APIs
    ("/api/health", 200),
    ("/api/pages", 200),
    ("/api/equipment/?limit=2", 200),
    ("/api/kamgar/profiles?limit=2", 200),
    ("/api/fertilizer/products?limit=2", 200),
    ("/api/transport/?limit=2", 200),

    # Pages via /pages/<name>.html
    ("/pages/equipment.html", 200),
    ("/pages/kamgar.html", 200),
    ("/pages/fertilizer.html", 200),
    ("/pages/transport.html", 200),
    ("/pages/contact.html", 200),
    ("/pages/login.html", 200),
    ("/pages/register.html", 200),
    ("/pages/my-orders.html", 200),
    ("/pages/my-rentals.html", 200),
    ("/pages/my-worker-bookings.html", 200),
    ("/pages/my-transports.html", 200),
    ("/pages/owner-dashboard.html", 200),
    ("/pages/supplier-dashboard.html", 200),
    ("/pages/kamgar-dashboard.html", 200),
    ("/pages/transport-dashboard.html", 200),
    ("/pages/admin-panel.html", 200),
    ("/pages/admin-login.html", 200),
    ("/pages/worker-login.html", 200),
    ("/pages/fertilizer-login.html", 200),
    ("/pages/transport-login.html", 200),
    ("/pages/equipment-detail.html", 200),
    ("/pages/worker-detail.html", 200),
    ("/pages/transport-detail.html", 200),
    ("/pages/fertilizer-detail.html", 200),

    # Pages via clean URLs (/pages/<name> without .html)
    ("/pages/equipment", 200),
    ("/pages/kamgar", 200),
    ("/pages/fertilizer", 200),
    ("/pages/transport", 200),
    ("/pages/contact", 200),

    # Pages via root clean URLs (/<name>)
    ("/equipment", 200),
    ("/kamgar", 200),
    ("/fertilizer", 200),
    ("/transport", 200),
    ("/contact", 200),
    ("/login", 200),
    ("/register", 200),
    ("/my-orders", 200),
    ("/my-rentals", 200),
    ("/admin-panel", 200),
    ("/owner-dashboard", 200),
    ("/supplier-dashboard", 200),
    ("/kamgar-dashboard", 200),
    ("/transport-dashboard", 200),
]

passed = 0
failed = 0

print(f"Testing {len(test_paths)} routes against {base} ...", flush=True)

for path, expected_status in test_paths:
    url = base + path
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "KrishiYantraVerifier/1.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            status = resp.status
            if status == expected_status:
                passed += 1
                print(f"  [PASS] {path} -> {status}", flush=True)
            else:
                failed += 1
                print(f"  [FAIL] {path} -> expected {expected_status}, got {status}", flush=True)
    except urllib.error.HTTPError as e:
        if e.code == expected_status:
            passed += 1
            print(f"  [PASS] {path} -> HTTP {e.code}", flush=True)
        else:
            failed += 1
            print(f"  [FAIL] {path} -> HTTP {e.code}", flush=True)
    except Exception as e:
        failed += 1
        print(f"  [ERR] {path} -> {e}", flush=True)

print(f"\nResult: {passed} passed, {failed} failed out of {len(test_paths)} tests.", flush=True)
if failed > 0:
    sys.exit(1)
