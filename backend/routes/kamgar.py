from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime
import hashlib
import hmac
import os

import razorpay
from config.db import mongo
from utils.auth_middleware import get_current_user, require_auth, require_roles

kamgar_bp = Blueprint('kamgar', __name__)
ACTIVE_JOB_STATUSES = {'requested', 'accepted', 'in_progress'}


def _clean_string(value, default=''):
    return str(value or default).strip()


def _parse_float(value, default=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _parse_date_value(raw_value):
    text = str(raw_value or '').strip()
    if not text:
        return None
    try:
        return datetime.datetime.strptime(text, '%Y-%m-%d').date()
    except ValueError:
        return None


def _expire_overdue_jobs(worker_id):
    today = datetime.datetime.utcnow().strftime('%Y-%m-%d')
    query = {
        'worker_id': worker_id,
        'status': {'$in': list(ACTIVE_JOB_STATUSES)},
        'end_date': {'$lt': today}
    }
    completed = mongo.db.kamgar_jobs.update_many(
        {**query, 'status': {'$in': ['accepted', 'in_progress']}},
        {'$set': {'status': 'completed', 'auto_completed_at': datetime.datetime.utcnow()}}
    )
    cancelled = mongo.db.kamgar_jobs.update_many(
        {**query, 'status': 'requested'},
        {
            '$set': {
                'status': 'cancelled',
                'cancel_reason': 'Hire request auto-cancelled after end date passed',
                'cancelled_at': datetime.datetime.utcnow()
            }
        }
    )
    return (completed.modified_count or 0) + (cancelled.modified_count or 0)


def _active_job_window(worker_id):
    _expire_overdue_jobs(worker_id)
    active = mongo.db.kamgar_jobs.find_one(
        {'worker_id': worker_id, 'status': {'$in': list(ACTIVE_JOB_STATUSES)}},
        sort=[('end_date', 1), ('start_date', 1), ('created_at', 1)]
    )
    if not active:
        return None

    start_date = _parse_date_value(active.get('start_date'))
    end_date = _parse_date_value(active.get('end_date'))
    today = datetime.datetime.utcnow().date()
    available_on = end_date.strftime('%Y-%m-%d') if end_date else ''
    available_on_label = end_date.strftime('%d %b %Y') if end_date else ''
    return {
        'job_id': str(active['_id']),
        'start_date': str(active.get('start_date', '')),
        'end_date': str(active.get('end_date', '')),
        'available_on': available_on,
        'available_on_label': available_on_label,
        'days_until_available': max((end_date - today).days, 0) if end_date else 0,
        'booked_days': (end_date - start_date).days + 1 if start_date and end_date and end_date >= start_date else 0
    }


def _fetch_published_workers(filters=None, limit=None):
    query = {'status': 'active'}
    if filters:
        if filters.get('location'):
            query['location'] = {'$regex': filters['location'], '$options': 'i'}
        if filters.get('skill'):
            query['skills'] = {'$in': [filters['skill']]}
        if filters.get('min_rate') is not None:
            query['hourly_rate'] = {'$gte': _parse_float(filters['min_rate'], 0)}
        if filters.get('max_rate') is not None:
            query.setdefault('hourly_rate', {})
            query['hourly_rate']['$lte'] = _parse_float(filters['max_rate'], 999999)
    workers = []
    cursor = mongo.db.kamgar_profiles.find(query).sort('created_at', -1)
    for profile in cursor:
        active_window = _active_job_window(profile['_id'])
        if filters and filters.get('available_only') and (not profile.get('available', True) or active_window):
            continue
        profile['_active_job_window'] = active_window
        workers.append(profile)
        if limit and len(workers) >= limit:
            break
    return workers


def _serialize_worker(profile):
    active_window = profile.get('_active_job_window')
    manually_available = bool(profile.get('available', True))
    effective_available = manually_available and active_window is None
    return {
        'id': str(profile['_id']),
        'user_id': str(profile.get('user_id', '')),
        'name': profile.get('name', ''),
        'phone': profile.get('phone', ''),
        'location': profile.get('location', ''),
        'skills': profile.get('skills', []),
        'experience_years': profile.get('experience_years', 0),
        'availability': profile.get('availability', 'Immediate'),
        'hourly_rate': profile.get('hourly_rate', 0),
        'daily_rate': profile.get('daily_rate', 0),
        'description': profile.get('description', ''),
        'photo_url': profile.get('photo_url', ''),
        'available': effective_available,
        'profile_available': manually_available,
        'unavailable_reason': 'hired' if active_window else ('worker_unavailable' if not manually_available else ''),
        'unavailable_until_date': (active_window or {}).get('available_on', ''),
        'unavailable_until_label': (active_window or {}).get('available_on_label', ''),
        'days_until_available': (active_window or {}).get('days_until_available', 0),
        'active_hire': active_window,
        'status': profile.get('status', 'active'),
        'rating_avg': profile.get('rating_avg', 0),
        'rating_count': profile.get('rating_count', 0),
        'created_at': str(profile.get('created_at', '')),
        'updated_at': str(profile.get('updated_at', ''))
    }


def _serialize_job(job):
    return {
        'id': str(job['_id']),
        'worker_id': str(job.get('worker_id', '')),
        'farmer_id': str(job.get('farmer_id', '')),
        'farmer_name': job.get('farmer_name', ''),
        'worker_name': job.get('worker_name', ''),
        'location': job.get('location', ''),
        'job_type': job.get('job_type', 'field_work'),
        'title': job.get('title', ''),
        'description': job.get('description', ''),
        'start_date': job.get('start_date', ''),
        'end_date': job.get('end_date', ''),
        'work_hours': job.get('work_hours', ''),
        'estimated_cost': job.get('estimated_cost', 0),
        'payment_status': job.get('payment_status', 'pending'),
        'status': job.get('status', 'requested'),
        'created_at': str(job.get('created_at', ''))
    }


@kamgar_bp.route('/profiles', methods=['GET'])
def list_workers():
    filters = {
        'location': request.args.get('location', ''),
        'skill': request.args.get('skill', ''),
        'available_only': request.args.get('available_only', 'false').lower() == 'true',
        'min_rate': request.args.get('min_rate'),
        'max_rate': request.args.get('max_rate')
    }
    try:
        limit = int(request.args.get('limit', 0)) or None
    except (TypeError, ValueError):
        limit = None
    workers = _fetch_published_workers(filters, limit=limit)
    return jsonify({'workers': [_serialize_worker(doc) for doc in workers]})


@kamgar_bp.route('/profiles/my', methods=['GET'])
@require_auth
def my_worker_profile():
    user = get_current_user()
    profile = mongo.db.kamgar_profiles.find_one({'user_id': user['_id']})
    if not profile:
        return jsonify({'error': 'Worker profile not found'}), 404
    profile['_active_job_window'] = _active_job_window(profile['_id'])
    return jsonify({'worker': _serialize_worker(profile)})


@kamgar_bp.route('/profiles', methods=['POST'])
@require_auth
def create_worker_profile():
    user = get_current_user()
    if str(user.get('role', 'renter')).lower() != 'kamgar':
        return jsonify({'error': 'Only Kamgar/workers can create worker profiles'}), 403

    data = request.get_json() or {}
    profile_data = {
        'user_id': user['_id'],
        'name': _clean_string(data.get('name')) or user.get('name', ''),
        'phone': _clean_string(data.get('phone')) or user.get('phone', ''),
        'location': _clean_string(data.get('location')) or user.get('location', ''),
        'skills': [str(item).strip() for item in (data.get('skills') or []) if str(item).strip()],
        'experience_years': int(data.get('experience_years', 0) or 0),
        'availability': _clean_string(data.get('availability'), 'Immediate'),
        'hourly_rate': _parse_float(data.get('hourly_rate', 0), 0),
        'daily_rate': _parse_float(data.get('daily_rate', 0), 0),
        'description': _clean_string(data.get('description')),
        'photo_url': _clean_string(data.get('photo_url')),
        'available': bool(data.get('available', True)),
        'status': 'active',
        'rating_avg': 0,
        'rating_count': 0,
        'created_at': datetime.datetime.utcnow(),
        'updated_at': datetime.datetime.utcnow(),
    }

    if not profile_data['location'] or not profile_data['skills']:
        return jsonify({'error': 'location and skills are required'}), 400

    existing = mongo.db.kamgar_profiles.find_one({'user_id': user['_id']})
    if existing:
        mongo.db.kamgar_profiles.update_one({'_id': existing['_id']}, {'$set': profile_data})
        profile = mongo.db.kamgar_profiles.find_one({'_id': existing['_id']})
    else:
        profile_id = mongo.db.kamgar_profiles.insert_one(profile_data)
        profile = mongo.db.kamgar_profiles.find_one({'_id': profile_id.inserted_id})

    return jsonify({'message': 'Worker profile saved', 'worker': _serialize_worker(profile)}), 201


@kamgar_bp.route('/profiles/<worker_id>', methods=['GET'])
def get_worker_profile(worker_id):
    try:
        worker_obj_id = ObjectId(worker_id)
    except Exception:
        return jsonify({'error': 'Invalid worker id'}), 400
    profile = mongo.db.kamgar_profiles.find_one({'_id': worker_obj_id, 'status': 'active'})
    if not profile:
        return jsonify({'error': 'Worker profile not found'}), 404
    profile['_active_job_window'] = _active_job_window(profile['_id'])
    return jsonify({'worker': _serialize_worker(profile)})


def _validate_worker_booking_payload(data):
    worker_id = str(data.get('worker_id', '')).strip()
    title = str(data.get('title', '')).strip()
    description = str(data.get('description', '')).strip()
    location = str(data.get('location', '')).strip()
    start_date = str(data.get('start_date', '')).strip()
    end_date = str(data.get('end_date', '')).strip()
    work_hours = str(data.get('work_hours', '')).strip()
    estimated_cost = float(data.get('estimated_cost', 0) or 0)
    job_type = str(data.get('job_type', 'field_work')).strip() or 'field_work'

    if not all([worker_id, title, location, start_date, end_date]):
        return None, 'worker_id, title, location, start_date and end_date are required'
    if estimated_cost <= 0:
        return None, 'estimated_cost must be greater than 0'
    return {
        'worker_id': worker_id,
        'title': title,
        'description': description,
        'location': location,
        'start_date': start_date,
        'end_date': end_date,
        'work_hours': work_hours,
        'estimated_cost': estimated_cost,
        'job_type': job_type
    }, None


def _get_worker_for_booking(worker_id, user_id):
    try:
        worker_obj_id = ObjectId(worker_id)
    except Exception:
        return None, 'Invalid worker id', 400

    worker = mongo.db.kamgar_profiles.find_one({'_id': worker_obj_id, 'status': 'active'})
    if not worker:
        return None, 'Worker not found', 404

    _expire_overdue_jobs(worker_obj_id)
    active_window = _active_job_window(worker_obj_id)
    if active_window:
        return None, 'Worker is unavailable for the selected dates', 409

    return worker, None, None


def _create_job_doc(user, worker, booking):
    return {
        'worker_id': worker['_id'],
        'farmer_id': user['_id'],
        'farmer_name': user.get('name', ''),
        'worker_name': worker.get('name', ''),
        'location': booking['location'],
        'job_type': booking['job_type'],
        'title': booking['title'],
        'description': booking['description'],
        'start_date': booking['start_date'],
        'end_date': booking['end_date'],
        'work_hours': booking['work_hours'],
        'estimated_cost': booking['estimated_cost'],
        'payment_status': 'paid',
        'payment_id': '',
        'payment_order_id': '',
        'status': 'requested',
        'created_at': datetime.datetime.utcnow()
    }


@kamgar_bp.route('/payment/order', methods=['POST'])
@require_auth
def create_kamgar_payment_order():
    user = get_current_user()
    data = request.get_json()
    booking, error = _validate_worker_booking_payload(data)
    if error:
        return jsonify({'error': error}), 400

    key_id = os.getenv('RAZORPAY_KEY_ID', '').strip()
    key_secret = os.getenv('RAZORPAY_KEY_SECRET', '').strip()
    if not key_id or not key_secret:
        return jsonify({'error': 'Payment gateway is not configured on server'}), 500

    try:
        _, eq_error, eq_status = _get_worker_for_booking(booking['worker_id'], user['_id'])
        if eq_error:
            return jsonify({'error': eq_error}), eq_status

        client = razorpay.Client(auth=(key_id, key_secret))
        receipt = f"kamgar_{str(user['_id'])[-6:]}_{int(datetime.datetime.utcnow().timestamp())}"
        order = client.order.create({
            'amount': int(booking['estimated_cost'] * 100),
            'currency': 'INR',
            'receipt': receipt,
            'notes': {
                'worker_id': booking['worker_id'],
                'start_date': booking['start_date'],
                'end_date': booking['end_date']
            }
        })

        return jsonify({
            'order_id': order.get('id'),
            'amount': order.get('amount'),
            'currency': order.get('currency', 'INR'),
            'key_id': key_id,
            'prefill': {
                'name': user.get('name', ''),
                'email': user.get('email', ''),
                'contact': user.get('phone', '')
            }
        })
    except Exception as e:
        return jsonify({'error': f'Failed to create payment order: {str(e)}'}), 400


@kamgar_bp.route('/payment/verify', methods=['POST'])
@require_auth
def verify_kamgar_payment_and_create_job():
    user = get_current_user()
    data = request.get_json()

    key_secret = os.getenv('RAZORPAY_KEY_SECRET', '').strip()
    if not key_secret:
        return jsonify({'error': 'Payment gateway is not configured on server'}), 500

    booking, error = _validate_worker_booking_payload(data)
    if error:
        return jsonify({'error': error}), 400

    order_id = data.get('razorpay_order_id', '').strip()
    payment_id = data.get('razorpay_payment_id', '').strip()
    signature = data.get('razorpay_signature', '').strip()
    if not order_id or not payment_id or not signature:
        return jsonify({'error': 'Missing payment verification fields'}), 400

    try:
        generated = hmac.new(
            key_secret.encode('utf-8'),
            f'{order_id}|{payment_id}'.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(generated, signature):
            return jsonify({'error': 'Payment signature verification failed'}), 400

        worker, eq_error, eq_status = _get_worker_for_booking(booking['worker_id'], user['_id'])
        if eq_error:
            return jsonify({'error': eq_error}), eq_status

        requested_start = datetime.datetime.strptime(booking['start_date'], '%Y-%m-%d').date()
        requested_end = datetime.datetime.strptime(booking['end_date'], '%Y-%m-%d').date()
        if requested_end < requested_start:
            return jsonify({'error': 'start_date and end_date must be valid dates, with end_date on or after start_date'}), 400

        overlapping_job = mongo.db.kamgar_jobs.find_one({
            'worker_id': worker['_id'],
            'status': {'$in': list(ACTIVE_JOB_STATUSES)},
            'start_date': {'$lte': booking['end_date']},
            'end_date': {'$gte': booking['start_date']}
        })
        if overlapping_job:
            return jsonify({'error': 'Worker became unavailable for the selected dates. Please choose different dates.'}), 409

        doc = _create_job_doc(user, worker, booking)
        doc['payment_status'] = 'paid'
        doc['payment_order_id'] = order_id
        doc['payment_id'] = payment_id
        result = mongo.db.kamgar_jobs.insert_one(doc)
        doc['_id'] = result.inserted_id
        return jsonify({'job': _serialize_job(doc)}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@kamgar_bp.route('/jobs', methods=['POST'])
@require_auth
def create_worker_booking():
    user = get_current_user()
    data = request.get_json() or {}
    worker_id = str(data.get('worker_id', '')).strip()
    title = _clean_string(data.get('title'))
    description = _clean_string(data.get('description'))
    location = _clean_string(data.get('location'))
    start_date = _clean_string(data.get('start_date'))
    end_date = _clean_string(data.get('end_date'))
    work_hours = _clean_string(data.get('work_hours'))
    estimated_cost = _parse_float(data.get('estimated_cost', 0), 0)

    if not all([worker_id, title, location, start_date, end_date]):
        return jsonify({'error': 'worker_id, title, location, start_date and end_date are required'}), 400

    requested_start = _parse_date_value(start_date)
    requested_end = _parse_date_value(end_date)
    if not requested_start or not requested_end or requested_end < requested_start:
        return jsonify({'error': 'start_date and end_date must be valid dates, with end_date on or after start_date'}), 400

    try:
        worker_obj_id = ObjectId(worker_id)
    except Exception:
        return jsonify({'error': 'Invalid worker id'}), 400

    worker = mongo.db.kamgar_profiles.find_one({'_id': worker_obj_id, 'status': 'active'})
    if not worker:
        return jsonify({'error': 'Worker not found'}), 404

    _expire_overdue_jobs(worker_obj_id)
    overlapping_job = mongo.db.kamgar_jobs.find_one({
        'worker_id': worker_obj_id,
        'status': {'$in': list(ACTIVE_JOB_STATUSES)},
        'start_date': {'$lte': end_date},
        'end_date': {'$gte': start_date}
    })
    if overlapping_job:
        active_window = _active_job_window(worker_obj_id)
        return jsonify({
            'error': 'Worker is unavailable for the selected dates',
            'available_on': (active_window or {}).get('available_on', ''),
            'available_on_label': (active_window or {}).get('available_on_label', '')
        }), 409

    farmer_name = user.get('name', '')
    booking = {
        'worker_id': worker_obj_id,
        'farmer_id': user['_id'],
        'farmer_name': farmer_name,
        'worker_name': worker.get('name', ''),
        'location': location,
        'job_type': str(data.get('job_type', 'field_work')).strip() or 'field_work',
        'title': title,
        'description': description,
        'start_date': start_date,
        'end_date': end_date,
        'work_hours': work_hours,
        'estimated_cost': estimated_cost,
        'payment_status': 'pending',
        'status': 'requested',
        'created_at': datetime.datetime.utcnow()
    }

    result = mongo.db.kamgar_jobs.insert_one(booking)
    return jsonify({'message': 'Worker request created', 'job': _serialize_job(mongo.db.kamgar_jobs.find_one({'_id': result.inserted_id}))}), 201


@kamgar_bp.route('/jobs/my', methods=['GET'])
@require_auth
def my_worker_jobs():
    user = get_current_user()
    query = {'$or': [{'farmer_id': user['_id']}, {'worker_id': {'$in': [ObjectId(user['_id']) if user.get('role') == 'kamgar' else user['_id']]}}]}
    if str(user.get('role', '')).lower() == 'kamgar':
        worker_profile = mongo.db.kamgar_profiles.find_one({'user_id': user['_id']})
        if worker_profile:
            query = {'worker_id': worker_profile['_id']}
        else:
            query = {'worker_id': ObjectId('000000000000000000000000')}
    else:
        query = {'farmer_id': user['_id']}

    jobs = list(mongo.db.kamgar_jobs.find(query).sort('created_at', -1))
    return jsonify({'jobs': [_serialize_job(job) for job in jobs]})


@kamgar_bp.route('/jobs/<job_id>/status', methods=['PUT'])
@require_auth
def update_worker_job_status(job_id):
    data = request.get_json() or {}
    status = str(data.get('status', 'accepted')).strip().lower()
    allowed = {'requested', 'accepted', 'in_progress', 'completed', 'cancelled'}
    if status not in allowed:
        return jsonify({'error': 'Invalid status'}), 400

    try:
        doc_id = ObjectId(job_id)
    except Exception:
        return jsonify({'error': 'Invalid job id'}), 400

    job = mongo.db.kamgar_jobs.find_one({'_id': doc_id})
    if not job:
        return jsonify({'error': 'Job not found'}), 404

    user = get_current_user()
    if str(user.get('role', '')).lower() == 'kamgar':
        worker_profile = mongo.db.kamgar_profiles.find_one({'user_id': user['_id']})
        if not worker_profile or str(job.get('worker_id')) != str(worker_profile['_id']):
            return jsonify({'error': 'You can only update your own worker jobs'}), 403
    elif str(job.get('farmer_id')) != str(user['_id']):
        return jsonify({'error': 'You can only update your own job requests'}), 403

    mongo.db.kamgar_jobs.update_one({'_id': doc_id}, {'$set': {'status': status, 'updated_at': datetime.datetime.utcnow()}})
    updated = mongo.db.kamgar_jobs.find_one({'_id': doc_id})
    return jsonify({'job': _serialize_job(updated)})


@kamgar_bp.route('/jobs', methods=['GET'])
@require_roles(['admin'])
def list_all_kamgar_jobs():
    jobs = list(mongo.db.kamgar_jobs.find().sort('created_at', -1))
    return jsonify({'jobs': [_serialize_job(job) for job in jobs]})
