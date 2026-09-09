from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
import os
import time
import threading
from config.db import mongo
from utils.auth_middleware import get_current_user, require_auth

auth_bp = Blueprint('auth', __name__)

# ── Server-side brute-force protection ──────────────────────────
_login_attempts = {}   # { ip: {'count': int, 'locked_until': float, 'last_reset': float} }
_attempts_lock  = threading.Lock()

FAILED_LIMIT        = 10    # max failures before server lockout (regular users)
ADMIN_FAILED_LIMIT  = 5     # stricter limit for admin
LOCKOUT_SECONDS     = 120   # 2 minute lockout
ADMIN_LOCKOUT_SEC   = 300   # 5 minute admin lockout

def _get_client_ip():
    xff = request.headers.get('X-Forwarded-For', '')
    return xff.split(',')[0].strip() if xff else (request.remote_addr or '0.0.0.0')

def _check_rate_limit(ip, limit=FAILED_LIMIT, lockout_sec=LOCKOUT_SECONDS):
    """Returns (allowed: bool, seconds_remaining: int)"""
    with _attempts_lock:
        data = _login_attempts.get(ip, {})
        locked_until = data.get('locked_until', 0)
        if locked_until > time.time():
            return False, int(locked_until - time.time())
        return True, 0

def _record_failed_attempt(ip, limit=FAILED_LIMIT, lockout_sec=LOCKOUT_SECONDS):
    with _attempts_lock:
        data = _login_attempts.get(ip, {'count': 0, 'locked_until': 0})
        data['count'] += 1
        data['last_attempt'] = time.time()
        if data['count'] >= limit:
            data['locked_until'] = time.time() + lockout_sec
        _login_attempts[ip] = data

def _reset_attempts(ip):
    with _attempts_lock:
        _login_attempts.pop(ip, None)


def _serialize_user(user):
    role = user.get('role', 'renter')
    kyc_status = user.get('kyc_status')
    if not kyc_status:
        kyc_status = 'approved' if role in {'owner', 'supplier', 'admin'} else 'not_required'

    user_id_str = str(user['_id'])
    return {
        'id': user_id_str,
        '_id': user_id_str,
        'name': user.get('name', ''),
        'email': user.get('email', ''),
        'role': role,
        'phone': user.get('phone', ''),
        'location': user.get('location', ''),
        'kyc_status': kyc_status,
        'kyc_review_notes': user.get('kyc_review_notes', '')
    }


def _admin_emails():
    raw = os.getenv('ADMIN_EMAILS', '').strip()
    if not raw:
        return set()
    return {email.strip().lower() for email in raw.split(',') if email.strip()}

def generate_token(user_id):
    payload = {
        'user_id': str(user_id),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=30)
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    location = data.get('location', '').strip()
    password = data.get('password', '')
    role = data.get('role', 'renter')
    role = role if role in {'renter', 'owner', 'kamgar', 'supplier'} else 'renter'

    is_admin_email = email in _admin_emails()
    if is_admin_email:
        role = 'admin'

    if not all([name, email, phone, password]):
        return jsonify({'error': 'All fields are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    # Check if user exists
    existing = mongo.db.users.find_one({'email': email})
    if existing:
        return jsonify({'error': 'Email already registered'}), 409

    hashed_pw = generate_password_hash(password)

    kyc_status = 'pending' if role in {'owner', 'kamgar', 'supplier'} else ('approved' if role == 'admin' else 'not_required')
    user_doc = {
        'name': name,
        'email': email,
        'phone': phone,
        'location': location,
        'password': hashed_pw,
        'role': role,
        'kyc_status': kyc_status,
        'kyc_details': {},
        'kyc_review_notes': '',
        'created_at': datetime.datetime.utcnow()
    }
    result = mongo.db.users.insert_one(user_doc)
    token = generate_token(result.inserted_id)

    created_user = dict(user_doc)
    created_user['_id'] = result.inserted_id

    return jsonify({
        'token': token,
        'user': _serialize_user(created_user)
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    ip = _get_client_ip()
    allowed, wait_sec = _check_rate_limit(ip)
    if not allowed:
        return jsonify({'error': f'Too many failed attempts. Please wait {wait_sec} seconds before trying again.'}), 429

    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = mongo.db.users.find_one({'email': email})
    if not user or not check_password_hash(user['password'], password):
        _record_failed_attempt(ip)
        return jsonify({'error': 'Invalid email or password'}), 401

    role = str(user.get('role', 'renter')).lower()
    if role not in ('renter', 'farmer'):
        _record_failed_attempt(ip)
        return jsonify({'error': 'Please use the login page for your account type'}), 403

    _reset_attempts(ip)
    token = generate_token(user['_id'])
    return jsonify({
        'token': token,
        'user': _serialize_user(user)
    })


@auth_bp.route('/login-owner', methods=['POST'])
def login_owner():
    ip = _get_client_ip()
    allowed, wait_sec = _check_rate_limit(ip)
    if not allowed:
        return jsonify({'error': f'Too many failed attempts. Please wait {wait_sec} seconds before trying again.'}), 429

    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = mongo.db.users.find_one({'email': email})
    if not user or not check_password_hash(user['password'], password):
        _record_failed_attempt(ip)
        return jsonify({'error': 'Invalid email or password'}), 401

    if str(user.get('role', 'renter')).lower() != 'owner':
        _record_failed_attempt(ip)
        return jsonify({'error': 'This account is not registered as owner'}), 403

    _reset_attempts(ip)
    token = generate_token(user['_id'])
    return jsonify({
        'token': token,
        'user': _serialize_user(user)
    })


@auth_bp.route('/login-supplier', methods=['POST'])
def login_supplier():
    ip = _get_client_ip()
    allowed, wait_sec = _check_rate_limit(ip)
    if not allowed:
        return jsonify({'error': f'Too many failed attempts. Please wait {wait_sec} seconds before trying again.'}), 429

    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = mongo.db.users.find_one({'email': email})
    if not user or not check_password_hash(user['password'], password):
        _record_failed_attempt(ip)
        return jsonify({'error': 'Invalid email or password'}), 401

    if str(user.get('role', 'renter')).lower() != 'supplier':
        _record_failed_attempt(ip)
        return jsonify({'error': 'This account is not registered as supplier'}), 403

    _reset_attempts(ip)
    token = generate_token(user['_id'])
    return jsonify({
        'token': token,
        'user': _serialize_user(user)
    })


@auth_bp.route('/login-kamgar', methods=['POST'])
def login_kamgar():
    ip = _get_client_ip()
    allowed, wait_sec = _check_rate_limit(ip)
    if not allowed:
        return jsonify({'error': f'Too many failed attempts. Please wait {wait_sec} seconds before trying again.'}), 429

    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = mongo.db.users.find_one({'email': email})
    if not user or not check_password_hash(user['password'], password):
        _record_failed_attempt(ip)
        return jsonify({'error': 'Invalid email or password'}), 401

    if str(user.get('role', 'renter')).lower() != 'kamgar':
        _record_failed_attempt(ip)
        return jsonify({'error': 'This account is not registered as worker'}), 403

    _reset_attempts(ip)
    token = generate_token(user['_id'])
    return jsonify({
        'token': token,
        'user': _serialize_user(user)
    })


@auth_bp.route('/login-admin', methods=['POST'])
def login_admin():
    ip = _get_client_ip()
    # Stricter rate limiting for admin endpoint
    allowed, wait_sec = _check_rate_limit(ip + '_admin', limit=ADMIN_FAILED_LIMIT, lockout_sec=ADMIN_LOCKOUT_SEC)
    if not allowed:
        return jsonify({'error': f'Admin portal locked. Please wait {wait_sec} seconds before trying again.'}), 429

    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = mongo.db.users.find_one({'email': email})
    if not user or not check_password_hash(user['password'], password):
        _record_failed_attempt(ip + '_admin', limit=ADMIN_FAILED_LIMIT, lockout_sec=ADMIN_LOCKOUT_SEC)
        return jsonify({'error': 'Invalid admin credentials'}), 401

    if str(user.get('role', 'renter')).lower() != 'admin':
        _record_failed_attempt(ip + '_admin', limit=ADMIN_FAILED_LIMIT, lockout_sec=ADMIN_LOCKOUT_SEC)
        return jsonify({'error': 'This account does not have admin access'}), 403

    _reset_attempts(ip + '_admin')
    token = generate_token(user['_id'])
    return jsonify({
        'token': token,
        'user': _serialize_user(user)
    })


@auth_bp.route('/me', methods=['GET'])
@require_auth
def me():
    user = get_current_user()
    return jsonify({'user': _serialize_user(user)})


@auth_bp.route('/me', methods=['PUT'])
@require_auth
def update_me():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}

    updatable_fields = {'name', 'phone', 'location', 'email'}
    update_doc = {}
    for field in updatable_fields:
        if field not in data:
            continue
        value = str(data.get(field, '')).strip()
        if field == 'email':
            value = value.lower()
        update_doc[field] = value

    if not update_doc:
        return jsonify({'error': 'No profile fields provided for update'}), 400

    if 'name' in update_doc and not update_doc['name']:
        return jsonify({'error': 'Name is required'}), 400

    if 'phone' in update_doc and not update_doc['phone']:
        return jsonify({'error': 'Phone is required'}), 400

    if 'email' in update_doc:
        if not update_doc['email']:
            return jsonify({'error': 'Email is required'}), 400

        existing = mongo.db.users.find_one({
            'email': update_doc['email'],
            '_id': {'$ne': user['_id']}
        })
        if existing:
            return jsonify({'error': 'Email already registered'}), 409

    update_doc['updated_at'] = datetime.datetime.utcnow()
    mongo.db.users.update_one(
        {'_id': user['_id']},
        {'$set': update_doc}
    )

    updated_user = mongo.db.users.find_one({'_id': user['_id']})
    return jsonify({
        'message': 'Profile updated successfully',
        'user': _serialize_user(updated_user)
    })
