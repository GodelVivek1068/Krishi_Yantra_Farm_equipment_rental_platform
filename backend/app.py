from flask import Flask, send_from_directory
from flask_cors import CORS
import os
from config.db import init_db
from routes.auth import auth_bp
from routes.equipment import equipment_bp
from routes.rentals import rentals_bp
from routes.contact import contact_bp
from routes.admin_marketplace import marketplace_admin_bp
from routes.kamgar import kamgar_bp
from routes.fertilizer import fertilizer_bp
from routes.transport import transport_bp


FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
PAGES_DIR = os.path.join(FRONTEND_DIR, 'pages')

def resolve_page_file(filename):
    """
    Safely resolves a requested filename or slug to an existing file in pages/ or frontend/.
    Supports both with and without .html extension.
    """
    if not filename:
        return None
    # Normalize path and strip leading slashes
    clean_name = os.path.normpath(filename.lstrip('/\\'))
    if clean_name.startswith('..') or os.path.isabs(clean_name):
        return None

    # Check 1: In pages/ as-is
    target_in_pages = os.path.join(PAGES_DIR, clean_name)
    if os.path.isfile(target_in_pages):
        return PAGES_DIR, clean_name.replace('\\', '/')

    # Check 2: In pages/ with .html appended
    if not clean_name.endswith('.html'):
        target_html = os.path.join(PAGES_DIR, f"{clean_name}.html")
        if os.path.isfile(target_html):
            return PAGES_DIR, f"{clean_name}.html".replace('\\', '/')

    # Check 3: In frontend/ root as-is
    target_in_root = os.path.join(FRONTEND_DIR, clean_name)
    if os.path.isfile(target_in_root):
        return FRONTEND_DIR, clean_name.replace('\\', '/')

    # Check 4: In frontend/ root with .html appended
    if not clean_name.endswith('.html'):
        target_root_html = os.path.join(FRONTEND_DIR, f"{clean_name}.html")
        if os.path.isfile(target_root_html):
            return FRONTEND_DIR, f"{clean_name}.html".replace('\\', '/')

    return None

def create_app():
    app = Flask(__name__)
    app.url_map.strict_slashes = False
    cors_origins = os.getenv('CORS_ORIGINS', '*').strip()
    if cors_origins == '*':
        CORS(app, origins='*')
    else:
        origins = [origin.strip() for origin in cors_origins.split(',') if origin.strip()]
        CORS(app, origins=origins)

    # Initialize DB
    init_db(app)

    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(equipment_bp, url_prefix='/api/equipment')
    app.register_blueprint(rentals_bp, url_prefix='/api/rentals')
    app.register_blueprint(contact_bp, url_prefix='/api/contact')
    app.register_blueprint(marketplace_admin_bp, url_prefix='/api/admin')
    app.register_blueprint(kamgar_bp, url_prefix='/api/kamgar')
    app.register_blueprint(fertilizer_bp, url_prefix='/api/fertilizer')
    app.register_blueprint(transport_bp, url_prefix='/api/transport')

    # Static Asset Routes
    @app.route('/css/<path:filename>')
    def css(filename):
        return send_from_directory(os.path.join(FRONTEND_DIR, 'css'), filename)

    @app.route('/js/<path:filename>')
    def js(filename):
        return send_from_directory(os.path.join(FRONTEND_DIR, 'js'), filename)

    @app.route('/images/<path:filename>')
    def images(filename):
        return send_from_directory(os.path.join(FRONTEND_DIR, 'images'), filename)

    @app.route('/favicon.svg')
    def favicon():
        return send_from_directory(FRONTEND_DIR, 'favicon.svg')

    # Root and index
    @app.route('/')
    def index():
        return send_from_directory(FRONTEND_DIR, 'index.html')

    @app.route('/index.html')
    def index_html():
        return send_from_directory(FRONTEND_DIR, 'index.html')

    # API Status & Route Discovery
    @app.route('/api')
    def api_root():
        return {
            "message": "KrishiYantra API is running 🚜",
            "version": "2.0",
            "status": "online"
        }

    @app.route('/api/health')
    def health():
        return {"status": "ok", "service": "KrishiYantra Backend", "version": "2.0"}

    @app.route('/api/pages')
    def list_pages():
        available_pages = [f for f in os.listdir(PAGES_DIR) if f.endswith('.html')]
        return {
            "root": "index.html",
            "pages": sorted(available_pages),
            "count": len(available_pages) + 1
        }

    # Pages subdirectory routes (/pages/<path>)
    @app.route('/pages/<path:filename>')
    def pages(filename):
        resolved = resolve_page_file(filename)
        if resolved:
            return send_from_directory(resolved[0], resolved[1])
        # Fallback to direct directory lookup
        return send_from_directory(PAGES_DIR, filename)

    @app.route('/pages/pages/<path:filename>')
    def pages_compat(filename):
        # Backward compatibility for older cached frontend links
        resolved = resolve_page_file(filename)
        if resolved:
            return send_from_directory(resolved[0], resolved[1])
        return send_from_directory(PAGES_DIR, filename)

    # Universal clean URL routing for all pages (e.g. /equipment, /kamgar, /fertilizer, /transport, /login, /register)
    @app.route('/<path:filename>')
    def catch_all_pages(filename):
        # Never catch API routes
        if filename.startswith('api/') or filename == 'api':
            return {"error": "API endpoint not found"}, 404
        resolved = resolve_page_file(filename)
        if resolved:
            return send_from_directory(resolved[0], resolved[1])
        # Fallback to index.html
        return send_from_directory(FRONTEND_DIR, 'index.html')

    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.getenv('PORT', '5000'))
    debug = os.getenv('FLASK_DEBUG', '0') == '1'
    app.run(debug=debug, host='0.0.0.0', port=port)
