from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime
import math
import re
import os
import hmac
import hashlib
import razorpay
from config.db import mongo
from utils.auth_middleware import get_current_user, require_auth

transport_bp = Blueprint('transport', __name__)
ACTIVE_BOOKING_STATUSES = {'pending', 'confirmed'}

LOCATION_COORDS = {
    'pune': (18.5204, 73.8567),
    'nashik': (19.9975, 73.7898),
    'solapur': (17.6599, 75.9064),
    'kolhapur': (16.7050, 74.2433),
    'latur': (18.4088, 76.5604),
    'aurangabad': (19.8762, 75.3433),
    'satara': (17.6805, 74.0183),
    'jalgaon': (21.0077, 75.5626),
    'sangli': (16.8524, 74.5815),
    'ahilyanagar': (19.0952, 74.7496),
    'ahmednagar': (19.0952, 74.7496),
    'mumbai': (19.0760, 72.8777),
    'nagpur': (21.1466, 79.0882),
    'chennai': (13.0827, 80.2707),
    'bangalore': (12.9716, 77.5946),
    'hyderabad': (17.3850, 78.4867)
}


def _safe_float(value):
    if value in (None, ''):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_text(value):
    return str(value or '').strip()


def _normalize_location_key(value):
    text = _normalize_text(value).lower()
    text = re.sub(r'[^a-z0-9\s]+', ' ', text)
    return ' '.join(text.split())


def _extract_city_district(location):
    parts = [part.strip() for part in str(location or '').split(',') if part.strip()]
    if not parts:
        return '', ''
    city = parts[0]
    district = parts[1] if len(parts) > 1 else parts[0]
    return city, district


def _coords_from_text(value):
    normalized = _normalize_location_key(value)
    if not normalized:
        return None, None
    if normalized in LOCATION_COORDS:
        return LOCATION_COORDS[normalized]
    for key, coords in LOCATION_COORDS.items():
        if key in normalized or normalized in key:
            return coords
    tokens = normalized.split()
    for token in tokens:
        if token in LOCATION_COORDS:
            return LOCATION_COORDS[token]
    return None, None


def _resolve_coordinates(location='', city='', district='', latitude=None, longitude=None):
    lat = _safe_float(latitude)
    lng = _safe_float(longitude)
    if lat is not None and lng is not None:
        return lat, lng
    for candidate in [city, district, location]:
        inferred_lat, inferred_lng = _coords_from_text(candidate)
        if inferred_lat is not None and inferred_lng is not None:
            return inferred_lat, inferred_lng
    return lat, lng


def _haversine_km(lat1, lng1, lat2, lng2):
    if None in (lat1, lng1, lat2, lng2):
        return None
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return round(r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def _transport_id_variants(transport_id):
    variants = []
    if isinstance(transport_id, ObjectId):
        variants.append(transport_id)
        variants.append(str(transport_id))
        return variants
    transport_id_str = str(transport_id or '').strip()
    if not transport_id_str:
        return variants
    variants.append(transport_id_str)
    try:
        variants.append(ObjectId(transport_id_str))
    except Exception:
        pass
    return variants


def _expire_overdue_bookings(transport_id):
    transport_id_variants = _transport_id_variants(transport_id)
    if not transport_id_variants:
        return 0
    today = datetime.datetime.utcnow().strftime('%Y-%m-%d')
    base_query = {
        'transport_id': {'$in': transport_id_variants},
        'status': {'$in': list(ACTIVE_BOOKING_STATUSES)},
        'end_date': {'$lt': today}
    }
    confirm_to_complete = mongo.db.transport_rentals.update_many(
        {**base_query, 'status': 'confirmed'},
        {'$set': {'status': 'completed', 'auto_completed_at': datetime.datetime.utcnow()}}
    )
    pending_to_cancel = mongo.db.transport_rentals.update_many(
        {**base_query, 'status': 'pending'},
        {
            '$set': {
                'status': 'cancelled',
                'cancel_reason': 'Booking auto-cancelled after rental end date passed',
                'cancelled_at': datetime.datetime.utcnow()
            }
        }
    )
    return (confirm_to_complete.modified_count or 0) + (pending_to_cancel.modified_count or 0)


def _build_active_booking_window(transport_id):
    transport_id_variants = _transport_id_variants(transport_id)
    if not transport_id_variants:
        return None
    _expire_overdue_bookings(transport_id)
    active = mongo.db.transport_rentals.find_one(
        {
            'transport_id': {'$in': transport_id_variants},
            'status': {'$in': list(ACTIVE_BOOKING_STATUSES)}
        },
        sort=[('end_date', 1), ('start_date', 1), ('created_at', 1)]
    )
    if not active:
        return None
    start_text = str(active.get('start_date', '') or '').strip()
    end_text = str(active.get('end_date', '') or '').strip()
    start_date = datetime.datetime.strptime(start_text, '%Y-%m-%d').date() if start_text else None
    end_date = datetime.datetime.strptime(end_text, '%Y-%m-%d').date() if end_text else None
    booked_days = 0
    if start_date and end_date and end_date >= start_date:
        booked_days = (end_date - start_date).days + 1
    days_until_available = 0
    available_on_label = ''
    if end_date:
        today = datetime.datetime.utcnow().date()
        days_until_available = max((end_date - today).days, 0)
        available_on_label = end_date.strftime('%d %b %Y')
    return {
        'booked_days': booked_days,
        'available_on': end_text,
        'available_on_label': available_on_label,
        'days_until_available': days_until_available
    }


def transport_to_dict(doc):
    expired_count = _expire_overdue_bookings(doc['_id'])
    active_booking_window = _build_active_booking_window(doc['_id'])
    has_active_booking = active_booking_window is not None
    if expired_count > 0 and not has_active_booking and doc.get('available', True) is False:
        mongo.db.transport_vehicles.update_one({'_id': doc['_id']}, {'$set': {'available': True}})
        doc['available'] = True
    lat, lng = _resolve_coordinates(
        doc.get('location', ''),
        doc.get('city', ''),
        doc.get('district', ''),
        doc.get('latitude'),
        doc.get('longitude')
    )
    return {
        '_id': str(doc['_id']),
        'name': doc.get('name'),
        'vehicle_type': doc.get('vehicle_type'),
        'capacity': doc.get('capacity', ''),
        'image_url': doc.get('image_url', ''),
        'rating_avg': float(doc.get('rating_avg', 0) or 0),
        'rating_count': int(doc.get('rating_count', 0) or 0),
        'price_per_day': doc.get('price_per_day'),
        'location': doc.get('location'),
        'description': doc.get('description', ''),
        'city': doc.get('city', ''),
        'district': doc.get('district', ''),
        'latitude': lat,
        'longitude': lng,
        'owner_name': doc.get('owner_name', ''),
        'owner_phone': doc.get('owner_phone', ''),
        'owner_id': str(doc.get('owner_id', '')),
        'available': bool(doc.get('available', True)) and not has_active_booking,
        'unavailable_booked_days': (active_booking_window or {}).get('booked_days', 0),
        'unavailable_until_date': (active_booking_window or {}).get('available_on', ''),
        'unavailable_until_label': (active_booking_window or {}).get('available_on_label', ''),
        'days_until_available': (active_booking_window or {}).get('days_until_available', 0),
        'created_at': str(doc.get('created_at', ''))
    }


def _validate_booking_payload(data):
    transport_id = data.get('transport_id')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    delivery_address = data.get('delivery_address', '').strip()
    goods_description = data.get('goods_description', '').strip()
    total_amount = int(data.get('total_amount', 0) or 0)
    if not all([transport_id, start_date, end_date, delivery_address]):
        return None, 'transport_id, start_date, end_date, and delivery_address are required'
    if total_amount <= 0:
        return None, 'total_amount must be greater than 0'
    return {
        'transport_id': transport_id,
        'start_date': start_date,
        'end_date': end_date,
        'delivery_address': delivery_address,
        'goods_description': goods_description,
        'total_amount': total_amount
    }, None


def _get_transport_for_booking(transport_id, user_id):
    try:
        transport_obj_id = ObjectId(transport_id)
    except Exception:
        return None, 'Invalid transport id', 400
    transport = mongo.db.transport_vehicles.find_one({'_id': transport_obj_id})
    if not transport:
        return None, 'Transport vehicle not found', 404
    _expire_overdue_bookings(transport_obj_id)
    transport = mongo.db.transport_vehicles.find_one({'_id': transport_obj_id}) or transport
    if str(transport.get('owner_id')) == str(user_id):
        return None, 'You cannot book your own transport', 400
    if transport.get('available', True) is False:
        return None, 'This transport is currently unavailable', 400
    return transport, None, None


def _create_rental_doc(user, transport, booking, payment):
    return {
        'transport_id': ObjectId(booking['transport_id']),
        'transport_name': transport['name'],
        'vehicle_type': transport.get('vehicle_type', 'truck'),
        'renter_id': user['_id'],
        'renter_name': user.get('name', ''),
        'renter_email': user.get('email', ''),
        'renter_phone': user.get('phone', ''),
        'owner_id': transport.get('owner_id'),
        'owner_id_str': str(transport.get('owner_id', '')),
        'owner_name': transport.get('owner_name', ''),
        'owner_phone': transport.get('owner_phone', ''),
        'start_date': booking['start_date'],
        'end_date': booking['end_date'],
        'delivery_address': booking['delivery_address'],
        'goods_description': booking['goods_description'],
        'total_amount': booking['total_amount'],
        'payment_status': 'paid',
        'payment_id': payment.get('payment_id', ''),
        'payment_order_id': payment.get('order_id', ''),
        'status': 'pending',
        'created_at': datetime.datetime.utcnow()
    }


def _owner_transport_ids(user_id):
    transport_ids = []
    user_id_str = str(user_id)
    query = {
        '$or': [
            {'owner_id': user_id},
            {'owner_id': user_id_str},
            {'owner_id_str': user_id_str}
        ]
    }
    for transport in mongo.db.transport_vehicles.find(query, {'_id': 1}):
        tid = transport.get('_id')
        if not tid:
            continue
        transport_ids.extend(_transport_id_variants(tid))
    unique_ids = []
    seen = set()
    for value in transport_ids:
        key = (type(value).__name__, str(value))
        if key in seen:
            continue
        seen.add(key)
        unique_ids.append(value)
    return unique_ids


def _rental_belongs_to_owner(rental, user_id, owner_transport_id_strs, owner_name='', owner_phone=''):
    user_id_str = str(user_id)
    user_name = str(owner_name or '').strip().lower()
    user_phone = str(owner_phone or '').strip()
    rental_owner_id = rental.get('owner_id')
    rental_owner_id_str = rental.get('owner_id_str')
    if str(rental_owner_id) == user_id_str:
        return True
    if str(rental_owner_id_str) == user_id_str:
        return True
    rental_transport_id = rental.get('transport_id')
    if str(rental_transport_id) in owner_transport_id_strs:
        return True
    rental_transport_id_str = rental.get('transport_id_str')
    if str(rental_transport_id_str) in owner_transport_id_strs:
        return True
    rental_owner_name = str(rental.get('owner_name', '')).strip().lower()
    if user_name and rental_owner_name and rental_owner_name == user_name:
        return True
    rental_owner_phone = str(rental.get('owner_phone', '')).strip()
    if user_phone and rental_owner_phone and rental_owner_phone == user_phone:
        return True
    return False


def transport_rental_to_dict(r):
    return {
        '_id': str(r['_id']),
        'transport_id': str(r.get('transport_id', '')),
        'transport_name': r.get('transport_name', ''),
        'vehicle_type': r.get('vehicle_type', 'truck'),
        'renter_id': str(r.get('renter_id', '')),
        'renter_name': r.get('renter_name', ''),
        'renter_email': r.get('renter_email', ''),
        'renter_phone': r.get('renter_phone', ''),
        'owner_id': str(r.get('owner_id', '')),
        'owner_name': r.get('owner_name', ''),
        'owner_phone': r.get('owner_phone', ''),
        'start_date': r.get('start_date', ''),
        'end_date': r.get('end_date', ''),
        'delivery_address': r.get('delivery_address', ''),
        'goods_description': r.get('goods_description', ''),
        'total_amount': r.get('total_amount', 0),
        'payment_status': r.get('payment_status', 'pending'),
        'payment_id': r.get('payment_id', ''),
        'payment_order_id': r.get('payment_order_id', ''),
        'status': r.get('status', 'pending'),
        'created_at': str(r.get('created_at', ''))
    }


@transport_bp.route('/', methods=['GET'])
def get_transport_vehicles():
    try:
        query = {}
        search = request.args.get('search')
        vehicle_type = request.args.get('vehicle_type')
        location = request.args.get('location')
        max_price = request.args.get('max_price')
        limit = int(request.args.get('limit', 50))
        sort = request.args.get('sort', 'newest')
        origin_lat = _safe_float(request.args.get('lat'))
        origin_lng = _safe_float(request.args.get('lng'))

        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'description': {'$regex': search, '$options': 'i'}}
            ]
        if vehicle_type:
            vt = vehicle_type.strip().lower()
            if vt in ['small_truck', 'small truck', 'mini_truck', 'mini truck']:
                query['vehicle_type'] = {'$in': ['small_truck', 'mini_truck']}
            elif vt in ['big_truck', 'big truck', 'truck', 'heavy truck']:
                query['vehicle_type'] = {'$in': ['big_truck', 'truck']}
            elif vt in ['tractor_trolley', 'tractor trolley', 'tractor with trolley', 'tractor with trolly', 'tractor']:
                query['vehicle_type'] = {'$in': ['tractor_trolley', 'tractor']}
            elif vt in ['pickup', 'pickups', 'pickup truck']:
                query['vehicle_type'] = {'$in': ['pickup', 'pickups']}
            else:
                query['vehicle_type'] = {'$regex': vehicle_type, '$options': 'i'}
        if location:
            query['location'] = {'$regex': location, '$options': 'i'}
        if max_price:
            query['price_per_day'] = {'$lte': int(max_price)}

        sort_field = [('created_at', -1)]
        if sort == 'price_asc':
            sort_field = [('price_per_day', 1)]
        elif sort == 'price_desc':
            sort_field = [('price_per_day', -1)]

        docs = list(mongo.db.transport_vehicles.find(query).sort(sort_field).limit(limit))
        transport = [transport_to_dict(d) for d in docs]
        return jsonify({'transport': transport, 'total': len(transport)})
    except Exception as e:
        return jsonify({
            'error': 'Failed to load transport vehicles. Check MONGO_URI and make sure MongoDB is running.',
            'details': str(e)
        }), 503


@transport_bp.route('/<transport_id>', methods=['GET'])
def get_transport_detail(transport_id):
    try:
        doc = mongo.db.transport_vehicles.find_one({'_id': ObjectId(transport_id)})
        if not doc:
            return jsonify({'error': 'Transport vehicle not found'}), 404
        return jsonify({'transport': transport_to_dict(doc)})
    except Exception:
        return jsonify({'error': 'Invalid ID'}), 400


@transport_bp.route('/', methods=['POST'])
@require_auth
def create_transport():
    user = get_current_user()
    data = request.get_json()
    if user.get('role', 'renter') != 'owner':
        return jsonify({'error': 'Only owners can list transport vehicles'}), 403
    owner_kyc_status = str(user.get('kyc_status', 'approved')).lower()
    if owner_kyc_status != 'approved':
        return jsonify({
            'error': 'Owner KYC is not approved yet. Submit KYC and wait for admin approval before listing transport.'
        }), 403
    name = data.get('name', '').strip()
    vehicle_type = data.get('vehicle_type', '').strip()
    price_per_day = data.get('price_per_day')
    location = data.get('location', '').strip()
    city = _normalize_text(data.get('city', ''))
    district = _normalize_text(data.get('district', ''))
    latitude = _safe_float(data.get('latitude'))
    longitude = _safe_float(data.get('longitude'))
    if not city or not district:
        inferred_city, inferred_district = _extract_city_district(location)
        city = city or inferred_city
        district = district or inferred_district
    latitude, longitude = _resolve_coordinates(location, city, district, latitude, longitude)
    if not all([name, vehicle_type, price_per_day, location]):
        return jsonify({'error': 'Name, vehicle type, price, and location are required'}), 400
    doc = {
        'name': name,
        'vehicle_type': vehicle_type,
        'image_url': data.get('image_url', '').strip(),
        'capacity': _normalize_text(data.get('capacity', '')),
        'price_per_day': int(price_per_day),
        'location': location,
        'city': city,
        'district': district,
        'latitude': latitude,
        'longitude': longitude,
        'description': data.get('description', ''),
        'owner_phone': data.get('owner_phone', user.get('phone', '')),
        'owner_name': user.get('name', ''),
        'owner_id': user['_id'],
        'owner_id_str': str(user['_id']),
        'rating_avg': 0,
        'rating_count': 0,
        'available': True,
        'created_at': datetime.datetime.utcnow()
    }
    result = mongo.db.transport_vehicles.insert_one(doc)
    doc['_id'] = result.inserted_id
    return jsonify({'transport': transport_to_dict(doc)}), 201


@transport_bp.route('/my', methods=['GET'])
@require_auth
def my_transport():
    user = get_current_user()
    if str(user.get('role', 'renter')).lower() != 'owner':
        return jsonify({'error': 'Only transport owners can manage vehicles'}), 403
    user_id_str = str(user['_id'])
    vehicles = list(mongo.db.transport_vehicles.find({
        '$or': [
            {'owner_id': user['_id']},
            {'owner_id': user_id_str},
            {'owner_id_str': user_id_str}
        ]
    }))
    return jsonify({'transport': [transport_to_dict(v) for v in vehicles]})


@transport_bp.route('/<transport_id>', methods=['PUT'])
@require_auth
def update_transport(transport_id):
    user = get_current_user()
    data = request.get_json()
    try:
        doc = mongo.db.transport_vehicles.find_one({'_id': ObjectId(transport_id)})
        if not doc:
            return jsonify({'error': 'Not found'}), 404
        if str(doc['owner_id']) != str(user['_id']):
            return jsonify({'error': 'Unauthorized'}), 403
        update_fields = {k: v for k, v in data.items() if k not in ['_id', 'owner_id']}
        if any(field in data for field in ['location', 'city', 'district', 'latitude', 'longitude']):
            location = _normalize_text(data.get('location', doc.get('location', '')))
            city = _normalize_text(data.get('city', doc.get('city', '')))
            district = _normalize_text(data.get('district', doc.get('district', '')))
            latitude = _safe_float(data.get('latitude', doc.get('latitude')))
            longitude = _safe_float(data.get('longitude', doc.get('longitude')))
            if not city or not district:
                inferred_city, inferred_district = _extract_city_district(location)
                city = city or inferred_city
                district = district or inferred_district
            latitude, longitude = _resolve_coordinates(location, city, district, latitude, longitude)
            update_fields['location'] = location
            update_fields['city'] = city
            update_fields['district'] = district
            update_fields['latitude'] = latitude
            update_fields['longitude'] = longitude
        mongo.db.transport_vehicles.update_one({'_id': ObjectId(transport_id)}, {'$set': update_fields})
        updated = mongo.db.transport_vehicles.find_one({'_id': ObjectId(transport_id)})
        return jsonify({'transport': transport_to_dict(updated)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@transport_bp.route('/<transport_id>', methods=['DELETE'])
@require_auth
def delete_transport(transport_id):
    user = get_current_user()
    try:
        doc = mongo.db.transport_vehicles.find_one({'_id': ObjectId(transport_id)})
        if not doc:
            return jsonify({'error': 'Not found'}), 404
        if str(doc['owner_id']) != str(user['_id']):
            return jsonify({'error': 'Unauthorized'}), 403
        mongo.db.transport_vehicles.delete_one({'_id': ObjectId(transport_id)})
        return jsonify({'message': 'Transport vehicle deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@transport_bp.route('/payment/order', methods=['POST'])
@require_auth
def create_transport_payment_order():
    user = get_current_user()
    data = request.get_json()
    booking, error = _validate_booking_payload(data)
    if error:
        return jsonify({'error': error}), 400
    key_id = os.getenv('RAZORPAY_KEY_ID', '').strip()
    key_secret = os.getenv('RAZORPAY_KEY_SECRET', '').strip()
    if not key_id or not key_secret:
        return jsonify({'error': 'Payment gateway is not configured on server'}), 500
    try:
        _, eq_error, eq_status = _get_transport_for_booking(booking['transport_id'], user['_id'])
        if eq_error:
            return jsonify({'error': eq_error}), eq_status
        client = razorpay.Client(auth=(key_id, key_secret))
        receipt = f"transport_{str(user['_id'])[-6:]}_{int(datetime.datetime.utcnow().timestamp())}"
        order = client.order.create({
            'amount': booking['total_amount'] * 100,
            'currency': 'INR',
            'receipt': receipt,
            'notes': {
                'transport_id': booking['transport_id'],
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


@transport_bp.route('/payment/verify', methods=['POST'])
@require_auth
def verify_transport_payment_and_create_rental():
    user = get_current_user()
    data = request.get_json()
    key_secret = os.getenv('RAZORPAY_KEY_SECRET', '').strip()
    if not key_secret:
        return jsonify({'error': 'Payment gateway is not configured on server'}), 500
    booking, error = _validate_booking_payload(data)
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
        transport, eq_error, eq_status = _get_transport_for_booking(booking['transport_id'], user['_id'])
        if eq_error:
            return jsonify({'error': eq_error}), eq_status
        doc = _create_rental_doc(user, transport, booking, {
            'payment_id': payment_id,
            'order_id': order_id
        })
        result = mongo.db.transport_rentals.insert_one(doc)
        doc['_id'] = result.inserted_id
        return jsonify({'rental': transport_rental_to_dict(doc)}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@transport_bp.route('/my-bookings', methods=['GET'])
@require_auth
def my_transport_bookings():
    user = get_current_user()
    rentals = list(mongo.db.transport_rentals.find({'renter_id': user['_id']}).sort('created_at', -1))
    return jsonify({'rentals': [transport_rental_to_dict(r) for r in rentals]})


@transport_bp.route('/owner', methods=['GET'])
@require_auth
def owner_transport_bookings():
    user = get_current_user()
    if str(user.get('role', 'renter')).lower() != 'owner':
        return jsonify({'error': 'Only transport owners can view owner bookings'}), 403
    owner_transport_id_strs = {str(value) for value in _owner_transport_ids(user['_id'])}
    user_name = str(user.get('name', '')).strip().lower()
    user_phone = str(user.get('phone', '')).strip()
    rentals = []
    for rental in mongo.db.transport_rentals.find().sort('created_at', -1):
        belongs = _rental_belongs_to_owner(rental, user['_id'], owner_transport_id_strs, user_name, user_phone)
        if not belongs:
            continue
        rental_owner_name = str(rental.get('owner_name', '')).strip().lower()
        rental_owner_phone = str(rental.get('owner_phone', '')).strip()
        if not rental.get('owner_id') or not rental.get('owner_id_str') or not rental_owner_name or not rental_owner_phone:
            mongo.db.transport_rentals.update_one(
                {'_id': rental['_id']},
                {
                    '$set': {
                        'owner_id': user['_id'],
                        'owner_id_str': str(user['_id']),
                        'owner_name': user.get('name', ''),
                        'owner_phone': user.get('phone', '')
                    }
                }
            )
            rental['owner_id'] = user['_id']
            rental['owner_id_str'] = str(user['_id'])
            rental['owner_name'] = user.get('name', '')
            rental['owner_phone'] = user.get('phone', '')
        renter_email = str(rental.get('renter_email', '')).strip()
        renter_phone = str(rental.get('renter_phone', '')).strip()
        if not renter_email or not renter_phone:
            renter_id = rental.get('renter_id')
            renter_user = None
            if isinstance(renter_id, ObjectId):
                renter_user = mongo.db.users.find_one({'_id': renter_id}, {'email': 1, 'phone': 1})
            else:
                renter_id_str = str(renter_id or '').strip()
                if renter_id_str:
                    try:
                        renter_user = mongo.db.users.find_one({'_id': ObjectId(renter_id_str)}, {'email': 1, 'phone': 1})
                    except Exception:
                        renter_user = None
            if renter_user:
                renter_email = str(renter_user.get('email', '')).strip()
                renter_phone = str(renter_user.get('phone', '')).strip()
                mongo.db.transport_rentals.update_one(
                    {'_id': rental['_id']},
                    {'$set': {'renter_email': renter_email, 'renter_phone': renter_phone}}
                )
                rental['renter_email'] = renter_email
                rental['renter_phone'] = renter_phone
        rentals.append(rental)
    return jsonify({'rentals': [transport_rental_to_dict(r) for r in rentals]})


@transport_bp.route('/<rental_id>/status', methods=['PUT'])
@require_auth
def update_transport_rental_status(rental_id):
    user = get_current_user()
    data = request.get_json()
    status = data.get('status')
    if status not in ['pending', 'confirmed', 'cancelled', 'completed']:
        return jsonify({'error': 'Invalid status'}), 400
    try:
        rental = mongo.db.transport_rentals.find_one({'_id': ObjectId(rental_id)})
        if not rental:
            return jsonify({'error': 'Not found'}), 404
        owner_transport_id_strs = {str(value) for value in _owner_transport_ids(user['_id'])}
        is_owner = _rental_belongs_to_owner(
            rental, user['_id'], owner_transport_id_strs,
            user.get('name', ''), user.get('phone', '')
        )
        is_renter = str(rental['renter_id']) == str(user['_id'])
        if not is_owner and not is_renter:
            return jsonify({'error': 'Unauthorized'}), 403
        if is_renter and not is_owner and status != 'cancelled':
            return jsonify({'error': 'Renter can only cancel booking'}), 403
        if is_owner and status == 'pending':
            return jsonify({'error': 'Owner cannot set status back to pending'}), 400
        update_fields = {'status': status}
        mongo.db.transport_rentals.update_one({'_id': ObjectId(rental_id)}, {'$set': update_fields})
        updated = mongo.db.transport_rentals.find_one({'_id': ObjectId(rental_id)})
        return jsonify({'rental': transport_rental_to_dict(updated)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400
