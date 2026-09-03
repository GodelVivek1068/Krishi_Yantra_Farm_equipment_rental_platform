from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime

from config.db import mongo
from utils.auth_middleware import get_current_user, require_auth, require_roles

kamgar_bp = Blueprint('kamgar', __name__)


def _clean_string(value, default=''):
    return str(value or default).strip()


def _parse_float(value, default=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _fetch_published_workers(filters=None):
    query = {'status': 'active'}
    if filters:
        if filters.get('location'):
            query['location'] = {'$regex': filters['location'], '$options': 'i'}
        if filters.get('skill'):
            query['skills'] = {'$in': [filters['skill']]} 
        if filters.get('available_only'):
            query['available'] = True
        if filters.get('min_rate') is not None:
            query['hourly_rate'] = {'$gte': _parse_float(filters['min_rate'], 0)}
        if filters.get('max_rate') is not None:
            query.setdefault('hourly_rate', {})
            query['hourly_rate']['$lte'] = _parse_float(filters['max_rate'], 999999)
    return list(mongo.db.kamgar_profiles.find(query).sort('created_at', -1))


def _serialize_worker(profile):
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
        'available': bool(profile.get('available', True)),
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
    workers = _fetch_published_workers(filters)
    return jsonify({'workers': [_serialize_worker(doc) for doc in workers]})


@kamgar_bp.route('/profiles/my', methods=['GET'])
@require_auth
def my_worker_profile():
    user = get_current_user()
    profile = mongo.db.kamgar_profiles.find_one({'user_id': user['_id']})
    if not profile:
        return jsonify({'error': 'Worker profile not found'}), 404
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
    return jsonify({'worker': _serialize_worker(profile)})


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

    try:
        worker_obj_id = ObjectId(worker_id)
    except Exception:
        return jsonify({'error': 'Invalid worker id'}), 400

    worker = mongo.db.kamgar_profiles.find_one({'_id': worker_obj_id, 'status': 'active'})
    if not worker:
        return jsonify({'error': 'Worker not found'}), 404

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
