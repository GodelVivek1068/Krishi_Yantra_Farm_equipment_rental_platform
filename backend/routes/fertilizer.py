from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime
import hashlib
import hmac
import os

import razorpay

from config.db import mongo
from utils.auth_middleware import get_current_user, require_auth, require_roles

fertilizer_bp = Blueprint('fertilizer', __name__)


def _clean(value, default=''):
    return str(value or default).strip()


def _parse_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _sync_product_availability(product_id):
    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        return
    product = mongo.db.fertilizer_products.find_one({'_id': product_obj_id})
    if not product:
        return
    stock_available = int(product.get('stock_available', 0) or 0)
    mongo.db.fertilizer_products.update_one(
        {'_id': product_obj_id},
        {'$set': {'available': stock_available > 0, 'updated_at': datetime.datetime.utcnow()}}
    )


def _serialize_product(product):
    stock_available = int(product.get('stock_available', 0) or 0)
    return {
        'id': str(product['_id']),
        'name': product.get('name', ''),
        'category': product.get('category', 'fertilizer'),
        'brand': product.get('brand', ''),
        'variant': product.get('variant', ''),
        'price_per_bag': product.get('price_per_bag', 0),
        'stock_available': stock_available,
        'available': bool(product.get('available', stock_available > 0)),
        'location': product.get('location', ''),
        'supplier_name': product.get('supplier_name', ''),
        'supplier_phone': product.get('supplier_phone', ''),
        'description': product.get('description', ''),
        'rating_avg': product.get('rating_avg', 0),
        'rating_count': product.get('rating_count', 0),
        'created_at': str(product.get('created_at', ''))
    }


def _serialize_order(order):
    return {
        'id': str(order['_id']),
        'product_id': str(order.get('product_id', '')),
        'product_name': order.get('product_name', ''),
        'farmer_id': str(order.get('farmer_id', '')),
        'farmer_name': order.get('farmer_name', ''),
        'supplier_id': str(order.get('supplier_id', '')),
        'supplier_name': order.get('supplier_name', ''),
        'quantity': order.get('quantity', 0),
        'unit_price': order.get('unit_price', 0),
        'total_amount': order.get('total_amount', 0),
        'delivery_location': order.get('delivery_location', ''),
        'delivery_date': order.get('delivery_date', ''),
        'status': order.get('status', 'requested'),
        'payment_status': order.get('payment_status', 'pending'),
        'created_at': str(order.get('created_at', ''))
    }


@fertilizer_bp.route('/products', methods=['GET'])
def list_products():
    query = {}
    category = request.args.get('category', '').strip()
    location = request.args.get('location', '').strip()
    brand = request.args.get('brand', '').strip()
    search = request.args.get('search', '').strip()
    available_only = request.args.get('available_only', '').strip().lower() == 'true'
    max_price = request.args.get('max_price', '').strip()
    supplier_id = request.args.get('supplier_id', '').strip()

    user = None
    try:
        user = get_current_user()
    except Exception:
        user = None

    if user and str(user.get('role', '')).lower() == 'supplier':
        query['supplier_id'] = user['_id']
    elif supplier_id:
        try:
            query['supplier_id'] = ObjectId(supplier_id)
        except Exception:
            query['supplier_id'] = supplier_id

    if category:
        query['category'] = {'$regex': category, '$options': 'i'}
    if location:
        query['location'] = {'$regex': location, '$options': 'i'}
    if brand:
        query['brand'] = {'$regex': brand, '$options': 'i'}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'brand': {'$regex': search, '$options': 'i'}},
            {'supplier_name': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]
    if available_only:
        query['available'] = True
    if max_price:
        try:
            query['price_per_bag'] = {'$lte': float(max_price)}
        except ValueError:
            pass

    products = list(mongo.db.fertilizer_products.find(query).sort('created_at', -1))
    return jsonify({'products': [_serialize_product(product) for product in products]})


@fertilizer_bp.route('/products', methods=['POST'])
@require_auth
@require_roles(['owner', 'supplier'])
def create_product():
    user = get_current_user()
    data = request.get_json() or {}
    stock_available = int(data.get('stock_available', 0) or 0)
    product = {
        'name': _clean(data.get('name')),
        'category': _clean(data.get('category'), 'fertilizer'),
        'brand': _clean(data.get('brand')),
        'variant': _clean(data.get('variant')),
        'price_per_bag': _parse_float(data.get('price_per_bag', 0), 0),
        'stock_available': stock_available,
        'available': stock_available > 0,
        'location': _clean(data.get('location')),
        'supplier_name': _clean(data.get('supplier_name')) or user.get('name', ''),
        'supplier_phone': _clean(data.get('supplier_phone')) or user.get('phone', ''),
        'description': _clean(data.get('description')),
        'supplier_id': user['_id'],
        'rating_avg': 0,
        'rating_count': 0,
        'created_at': datetime.datetime.utcnow(),
        'updated_at': datetime.datetime.utcnow(),
    }

    if not all([product['name'], product['location'], product['price_per_bag'] > 0]):
        return jsonify({'error': 'name, location and valid price_per_bag are required'}), 400

    result = mongo.db.fertilizer_products.insert_one(product)
    created = mongo.db.fertilizer_products.find_one({'_id': result.inserted_id})
    return jsonify({'message': 'Fertilizer product created', 'product': _serialize_product(created)}), 201


@fertilizer_bp.route('/products/<product_id>', methods=['GET'])
def get_product(product_id):
    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product id'}), 400

    product = mongo.db.fertilizer_products.find_one({'_id': product_obj_id})
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    return jsonify({'product': _serialize_product(product)})


@fertilizer_bp.route('/products/<product_id>', methods=['PUT'])
@require_auth
@require_roles(['owner', 'supplier'])
def update_product(product_id):
    user = get_current_user()
    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product id'}), 400

    product = mongo.db.fertilizer_products.find_one({'_id': product_obj_id})
    if not product:
        return jsonify({'error': 'Product not found'}), 404

    if str(product.get('supplier_id')) != str(user['_id']) and str(user.get('role', '')).lower() != 'admin':
        return jsonify({'error': 'You can only update your own fertilizer listings'}), 403

    data = request.get_json() or {}
    updates = {}
    if 'name' in data: updates['name'] = _clean(data.get('name'))
    if 'category' in data: updates['category'] = _clean(data.get('category'), 'fertilizer')
    if 'brand' in data: updates['brand'] = _clean(data.get('brand'))
    if 'variant' in data: updates['variant'] = _clean(data.get('variant'))
    if 'price_per_bag' in data: updates['price_per_bag'] = _parse_float(data.get('price_per_bag', 0), 0)
    if 'stock_available' in data: updates['stock_available'] = int(data.get('stock_available', 0) or 0)
    if 'location' in data: updates['location'] = _clean(data.get('location'))
    if 'supplier_name' in data: updates['supplier_name'] = _clean(data.get('supplier_name')) or user.get('name', '')
    if 'supplier_phone' in data: updates['supplier_phone'] = _clean(data.get('supplier_phone')) or user.get('phone', '')
    if 'description' in data: updates['description'] = _clean(data.get('description'))
    if 'available' in data: updates['available'] = bool(data.get('available'))
    if not updates:
        return jsonify({'error': 'No valid fields to update'}), 400

    if 'stock_available' in updates:
        updates['available'] = updates['stock_available'] > 0
    elif 'available' in updates and not updates['available']:
        updates['stock_available'] = 0

    updates['updated_at'] = datetime.datetime.utcnow()
    mongo.db.fertilizer_products.update_one({'_id': product_obj_id}, {'$set': updates})
    updated = mongo.db.fertilizer_products.find_one({'_id': product_obj_id})
    return jsonify({'message': 'Fertilizer product updated', 'product': _serialize_product(updated)})


@fertilizer_bp.route('/products/<product_id>', methods=['DELETE'])
@require_auth
@require_roles(['owner', 'supplier'])
def delete_product(product_id):
    user = get_current_user()
    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product id'}), 400

    product = mongo.db.fertilizer_products.find_one({'_id': product_obj_id})
    if not product:
        return jsonify({'error': 'Product not found'}), 404

    if str(product.get('supplier_id')) != str(user['_id']) and str(user.get('role', '')).lower() != 'admin':
        return jsonify({'error': 'You can only delete your own fertilizer listings'}), 403

    mongo.db.fertilizer_products.delete_one({'_id': product_obj_id})
    return jsonify({'message': 'Fertilizer product deleted'})


@fertilizer_bp.route('/orders', methods=['POST'])
@require_auth
def create_order():
    user = get_current_user()
    data = request.get_json() or {}
    product_id = str(data.get('product_id', '')).strip()
    quantity = int(data.get('quantity', 0) or 0)
    delivery_location = _clean(data.get('delivery_location'))
    delivery_date = _clean(data.get('delivery_date'))

    if not all([product_id, quantity > 0, delivery_location]):
        return jsonify({'error': 'product_id, valid quantity and delivery_location are required'}), 400

    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product id'}), 400

    product = mongo.db.fertilizer_products.find_one({'_id': product_obj_id})
    if not product:
        return jsonify({'error': 'Product not found'}), 404

    if int(product.get('stock_available', 0) or 0) < quantity:
        return jsonify({'error': 'Requested quantity exceeds available stock'}), 400

    if not data.get('payment_verified', False):
        return jsonify({'error': 'Payment is required before order confirmation'}), 400

    order = {
        'product_id': product_obj_id,
        'product_name': product.get('name', ''),
        'farmer_id': user['_id'],
        'farmer_name': user.get('name', ''),
        'supplier_id': product.get('supplier_id'),
        'supplier_name': product.get('supplier_name', ''),
        'quantity': quantity,
        'unit_price': product.get('price_per_bag', 0),
        'total_amount': product.get('price_per_bag', 0) * quantity,
        'delivery_location': delivery_location,
        'delivery_date': delivery_date,
        'payment_status': 'paid',
        'payment_id': data.get('payment_id', ''),
        'payment_order_id': data.get('payment_order_id', ''),
        'status': 'requested',
        'created_at': datetime.datetime.utcnow(),
        'updated_at': datetime.datetime.utcnow(),
    }

    result = mongo.db.fertilizer_orders.insert_one(order)
    created = mongo.db.fertilizer_orders.find_one({'_id': result.inserted_id})
    new_stock = int(product.get('stock_available', 0) or 0) - quantity
    mongo.db.fertilizer_products.update_one(
        {'_id': product_obj_id},
        {'$set': {'stock_available': new_stock, 'available': new_stock > 0, 'updated_at': datetime.datetime.utcnow()}}
    )
    return jsonify({'message': 'Fertilizer order placed', 'order': _serialize_order(created)}), 201


@fertilizer_bp.route('/orders/payment/order', methods=['POST'])
@require_auth
def create_payment_order():
    user = get_current_user()
    data = request.get_json() or {}
    product_id = str(data.get('product_id', '')).strip()
    quantity = int(data.get('quantity', 0) or 0)
    delivery_location = _clean(data.get('delivery_location'))
    delivery_date = _clean(data.get('delivery_date'))

    if not all([product_id, quantity > 0, delivery_location]):
        return jsonify({'error': 'product_id, valid quantity and delivery_location are required'}), 400

    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product id'}), 400

    product = mongo.db.fertilizer_products.find_one({'_id': product_obj_id})
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    if int(product.get('stock_available', 0) or 0) < quantity:
        return jsonify({'error': 'Requested quantity exceeds available stock'}), 400

    key_id = os.getenv('RAZORPAY_KEY_ID', '').strip()
    key_secret = os.getenv('RAZORPAY_KEY_SECRET', '').strip()
    if not key_id or not key_secret:
        return jsonify({'error': 'Payment gateway is not configured on server'}), 500

    total_amount = _parse_float(product.get('price_per_bag', 0), 0) * quantity
    client = razorpay.Client(auth=(key_id, key_secret))
    receipt = f"fert_{str(user['_id'])[-6:]}_{int(datetime.datetime.utcnow().timestamp())}"
    order = client.order.create({
        'amount': int(total_amount * 100),
        'currency': 'INR',
        'receipt': receipt,
        'notes': {
            'product_id': str(product_obj_id),
            'delivery_location': delivery_location,
            'delivery_date': delivery_date,
            'quantity': quantity,
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


@fertilizer_bp.route('/orders/payment/verify', methods=['POST'])
@require_auth
def verify_payment_and_create_order():
    user = get_current_user()
    data = request.get_json() or {}
    key_secret = os.getenv('RAZORPAY_KEY_SECRET', '').strip()
    if not key_secret:
        return jsonify({'error': 'Payment gateway is not configured on server'}), 500

    product_id = str(data.get('product_id', '')).strip()
    quantity = int(data.get('quantity', 0) or 0)
    delivery_location = _clean(data.get('delivery_location'))
    delivery_date = _clean(data.get('delivery_date'))

    if not all([product_id, quantity > 0, delivery_location]):
        return jsonify({'error': 'product_id, valid quantity and delivery_location are required'}), 400

    order_id = data.get('razorpay_order_id', '').strip()
    payment_id = data.get('razorpay_payment_id', '').strip()
    signature = data.get('razorpay_signature', '').strip()
    if not order_id or not payment_id or not signature:
        return jsonify({'error': 'Missing payment verification fields'}), 400

    generated = hmac.new(
        key_secret.encode('utf-8'),
        f'{order_id}|{payment_id}'.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(generated, signature):
        return jsonify({'error': 'Payment signature verification failed'}), 400

    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product id'}), 400

    product = mongo.db.fertilizer_products.find_one({'_id': product_obj_id})
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    if int(product.get('stock_available', 0) or 0) < quantity:
        return jsonify({'error': 'Requested quantity exceeds available stock'}), 400

    order = {
        'product_id': product_obj_id,
        'product_name': product.get('name', ''),
        'farmer_id': user['_id'],
        'farmer_name': user.get('name', ''),
        'supplier_id': product.get('supplier_id'),
        'supplier_name': product.get('supplier_name', ''),
        'quantity': quantity,
        'unit_price': product.get('price_per_bag', 0),
        'total_amount': product.get('price_per_bag', 0) * quantity,
        'delivery_location': delivery_location,
        'delivery_date': delivery_date,
        'payment_status': 'paid',
        'payment_id': payment_id,
        'payment_order_id': order_id,
        'status': 'requested',
        'created_at': datetime.datetime.utcnow(),
        'updated_at': datetime.datetime.utcnow(),
    }

    result = mongo.db.fertilizer_orders.insert_one(order)
    created = mongo.db.fertilizer_orders.find_one({'_id': result.inserted_id})
    new_stock = int(product.get('stock_available', 0) or 0) - quantity
    mongo.db.fertilizer_products.update_one(
        {'_id': product_obj_id},
        {'$set': {'stock_available': new_stock, 'available': new_stock > 0, 'updated_at': datetime.datetime.utcnow()}}
    )

    # Create notification for supplier
    supplier_id = product.get('supplier_id')
    if supplier_id:
        _create_notification(
            supplier_id,
            'new_order',
            'New Order Received',
            f'{user.get("name", "Farmer")} ordered {quantity} bags of {product.get("name", "fertilizer")}'
        )

    return jsonify({'message': 'Fertilizer order placed', 'order': _serialize_order(created)}), 201


@fertilizer_bp.route('/orders/my', methods=['GET'])
@require_auth
def my_orders():
    user = get_current_user()
    role = str(user.get('role', '')).lower()
    query = {'farmer_id': user['_id']}
    if role in {'owner', 'supplier'}:
        query = {'supplier_id': user['_id']}
    orders = list(mongo.db.fertilizer_orders.find(query).sort('created_at', -1))
    return jsonify({'orders': [_serialize_order(order) for order in orders]})


@fertilizer_bp.route('/orders/<order_id>/status', methods=['PUT'])
@require_auth
def update_order_status(order_id):
    data = request.get_json() or {}
    status = str(data.get('status', 'accepted')).strip().lower()
    allowed = {'requested', 'accepted', 'packed', 'dispatched', 'delivered', 'cancelled'}
    if status not in allowed:
        return jsonify({'error': 'Invalid status'}), 400

    try:
        doc_id = ObjectId(order_id)
    except Exception:
        return jsonify({'error': 'Invalid order id'}), 400

    order = mongo.db.fertilizer_orders.find_one({'_id': doc_id})
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    user = get_current_user()
    user_role = str(user.get('role', '')).lower()
    if user_role in {'owner', 'supplier'} and str(order.get('supplier_id')) != str(user['_id']):
        return jsonify({'error': 'Only the supplier can update this order'}), 403
    if user_role not in {'owner', 'supplier'} and str(order.get('farmer_id')) != str(user['_id']):
        return jsonify({'error': 'You can only update your own order'}), 403

    previous_status = str(order.get('status', '')).lower()
    mongo.db.fertilizer_orders.update_one({'_id': doc_id}, {'$set': {'status': status, 'updated_at': datetime.datetime.utcnow()}})
    
    # Create notification for farmer if status changed
    if status != previous_status and str(order.get('farmer_id')):
        status_msg = {
            'packed': 'Your order has been packed',
            'dispatched': 'Your order is on its way',
            'delivered': 'Your order has been delivered',
            'cancelled': 'Your order has been cancelled',
            'accepted': 'Your order has been accepted'
        }
        message = status_msg.get(status, f'Order status updated to {status}')
        _create_notification(
            order.get('farmer_id'),
            'order_status_update',
            f'Order {str(doc_id)[:8]}... Status Updated',
            message
        )
    
    if status == 'cancelled' and previous_status != 'cancelled':
        product_id = order.get('product_id')
        if product_id:
            quantity = int(order.get('quantity', 0) or 0)
            mongo.db.fertilizer_products.update_one(
                {'_id': product_id},
                {'$inc': {'stock_available': quantity}, '$set': {'available': True, 'updated_at': datetime.datetime.utcnow()}}
            )

    updated = mongo.db.fertilizer_orders.find_one({'_id': doc_id})
    return jsonify({'order': _serialize_order(updated)})


@fertilizer_bp.route('/orders', methods=['GET'])
@require_roles(['admin'])
def list_all_orders():
    orders = list(mongo.db.fertilizer_orders.find().sort('created_at', -1))
    return jsonify({'orders': [_serialize_order(order) for order in orders]})


# ===== RATINGS & REVIEWS =====
def _serialize_rating(rating):
    return {
        'id': str(rating['_id']),
        'product_id': str(rating.get('product_id', '')),
        'farmer_id': str(rating.get('farmer_id', '')),
        'farmer_name': rating.get('farmer_name', ''),
        'rating': rating.get('rating', 0),
        'comment': rating.get('comment', ''),
        'created_at': str(rating.get('created_at', ''))
    }


@fertilizer_bp.route('/products/<product_id>/ratings', methods=['GET'])
def get_product_ratings(product_id):
    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product id'}), 400

    ratings = list(mongo.db.fertilizer_ratings.find({'product_id': product_obj_id}).sort('created_at', -1))
    return jsonify({'ratings': [_serialize_rating(r) for r in ratings]})


@fertilizer_bp.route('/ratings', methods=['POST'])
@require_auth
def submit_rating():
    user = get_current_user()
    data = request.get_json() or {}
    product_id = str(data.get('product_id', '')).strip()
    rating = int(data.get('rating', 0) or 0)
    comment = _clean(data.get('comment', ''))

    if not product_id or rating < 1 or rating > 5:
        return jsonify({'error': 'Valid product_id and rating (1-5) are required'}), 400

    try:
        product_obj_id = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product id'}), 400

    product = mongo.db.fertilizer_products.find_one({'_id': product_obj_id})
    if not product:
        return jsonify({'error': 'Product not found'}), 404

    # Check if user already rated this product
    existing = mongo.db.fertilizer_ratings.find_one({
        'product_id': product_obj_id,
        'farmer_id': user['_id']
    })
    if existing:
        # Update existing rating
        mongo.db.fertilizer_ratings.update_one(
            {'_id': existing['_id']},
            {'$set': {'rating': rating, 'comment': comment, 'updated_at': datetime.datetime.utcnow()}}
        )
    else:
        # Insert new rating
        rating_doc = {
            'product_id': product_obj_id,
            'farmer_id': user['_id'],
            'farmer_name': user.get('name', ''),
            'rating': rating,
            'comment': comment,
            'created_at': datetime.datetime.utcnow(),
            'updated_at': datetime.datetime.utcnow()
        }
        mongo.db.fertilizer_ratings.insert_one(rating_doc)

    # Recalculate product rating average
    all_ratings = list(mongo.db.fertilizer_ratings.find({'product_id': product_obj_id}))
    if all_ratings:
        avg_rating = sum(r.get('rating', 0) for r in all_ratings) / len(all_ratings)
        mongo.db.fertilizer_products.update_one(
            {'_id': product_obj_id},
            {'$set': {'rating_avg': round(avg_rating, 2), 'rating_count': len(all_ratings)}}
        )

    return jsonify({'message': 'Rating submitted successfully'})


# ===== SUPPLIER ANALYTICS =====
@fertilizer_bp.route('/supplier/analytics', methods=['GET'])
@require_auth
@require_roles(['supplier'])
def supplier_analytics():
    user = get_current_user()
    supplier_id = user['_id']

    # Total products
    total_products = mongo.db.fertilizer_products.count_documents({'supplier_id': supplier_id})

    # Total orders
    orders = list(mongo.db.fertilizer_orders.find({'supplier_id': supplier_id}))
    total_orders = len(orders)
    total_revenue = sum(o.get('total_amount', 0) for o in orders)

    # Orders by status
    status_breakdown = {}
    for order in orders:
        status = order.get('status', 'unknown')
        status_breakdown[status] = status_breakdown.get(status, 0) + 1

    # Average rating
    products = list(mongo.db.fertilizer_products.find({'supplier_id': supplier_id}))
    avg_rating = 0
    total_ratings = 0
    if products:
        ratings = [p.get('rating_avg', 0) for p in products if p.get('rating_count', 0) > 0]
        if ratings:
            avg_rating = round(sum(ratings) / len(ratings), 2)
        total_ratings = sum(p.get('rating_count', 0) for p in products)

    return jsonify({
        'total_products': total_products,
        'total_orders': total_orders,
        'total_revenue': total_revenue,
        'status_breakdown': status_breakdown,
        'avg_rating': avg_rating,
        'total_ratings': total_ratings
    })


# ===== SUPPLIER PROFILE =====
def _serialize_supplier_profile(user, stats):
    return {
        'id': str(user['_id']),
        'name': user.get('name', ''),
        'phone': user.get('phone', ''),
        'location': user.get('location', ''),
        'company_name': user.get('company_name', user.get('name', '')),
        'company_description': user.get('company_description', ''),
        'company_website': user.get('company_website', ''),
        'avg_rating': stats.get('avg_rating', 0),
        'total_ratings': stats.get('total_ratings', 0),
        'total_products': stats.get('total_products', 0),
        'total_orders': stats.get('total_orders', 0)
    }


@fertilizer_bp.route('/supplier/<supplier_id>/profile', methods=['GET'])
def get_supplier_profile(supplier_id):
    try:
        supplier_obj_id = ObjectId(supplier_id)
    except Exception:
        return jsonify({'error': 'Invalid supplier id'}), 400

    user = mongo.db.users.find_one({'_id': supplier_obj_id, 'role': 'supplier'})
    if not user:
        return jsonify({'error': 'Supplier not found'}), 404

    # Get supplier stats
    total_products = mongo.db.fertilizer_products.count_documents({'supplier_id': supplier_obj_id})
    orders = list(mongo.db.fertilizer_orders.find({'supplier_id': supplier_obj_id}))
    total_orders = len(orders)
    total_revenue = sum(o.get('total_amount', 0) for o in orders)

    products = list(mongo.db.fertilizer_products.find({'supplier_id': supplier_obj_id}))
    avg_rating = 0
    total_ratings = 0
    if products:
        ratings = [p.get('rating_avg', 0) for p in products if p.get('rating_count', 0) > 0]
        if ratings:
            avg_rating = round(sum(ratings) / len(ratings), 2)
        total_ratings = sum(p.get('rating_count', 0) for p in products)

    stats = {
        'total_products': total_products,
        'total_orders': total_orders,
        'total_revenue': total_revenue,
        'avg_rating': avg_rating,
        'total_ratings': total_ratings
    }

    return jsonify({'profile': _serialize_supplier_profile(user, stats)})


@fertilizer_bp.route('/supplier/profile', methods=['PUT'])
@require_auth
@require_roles(['supplier'])
def update_supplier_profile():
    user = get_current_user()
    data = request.get_json() or {}
    updates = {}

    if 'company_name' in data: updates['company_name'] = _clean(data.get('company_name'))
    if 'company_description' in data: updates['company_description'] = _clean(data.get('company_description'))
    if 'company_website' in data: updates['company_website'] = _clean(data.get('company_website'))
    if 'phone' in data: updates['phone'] = _clean(data.get('phone'))
    if 'location' in data: updates['location'] = _clean(data.get('location'))

    if not updates:
        return jsonify({'error': 'No fields to update'}), 400

    mongo.db.users.update_one({'_id': user['_id']}, {'$set': updates})
    updated = mongo.db.users.find_one({'_id': user['_id']})

    return jsonify({'message': 'Profile updated', 'user': {
        'name': updated.get('name', ''),
        'phone': updated.get('phone', ''),
        'location': updated.get('location', ''),
        'company_name': updated.get('company_name', ''),
        'company_description': updated.get('company_description', ''),
        'company_website': updated.get('company_website', '')
    }})


# ===== BULK UPLOAD =====
@fertilizer_bp.route('/products/bulk-upload', methods=['POST'])
@require_auth
@require_roles(['supplier'])
def bulk_upload_products():
    user = get_current_user()
    data = request.get_json() or {}
    products_data = data.get('products', [])

    if not products_data or not isinstance(products_data, list):
        return jsonify({'error': 'products array is required'}), 400

    created_count = 0
    errors = []

    for idx, prod in enumerate(products_data):
        try:
            name = _clean(prod.get('name'))
            location = _clean(prod.get('location'))
            price_per_bag = _parse_float(prod.get('price_per_bag', 0), 0)
            stock = int(prod.get('stock_available', 0) or 0)

            if not all([name, location, price_per_bag > 0]):
                errors.append(f'Row {idx + 1}: Missing name, location, or valid price')
                continue

            product_doc = {
                'name': name,
                'category': _clean(prod.get('category'), 'fertilizer'),
                'brand': _clean(prod.get('brand')),
                'variant': _clean(prod.get('variant')),
                'price_per_bag': price_per_bag,
                'stock_available': stock,
                'available': stock > 0,
                'location': location,
                'supplier_name': _clean(prod.get('supplier_name')) or user.get('name', ''),
                'supplier_phone': _clean(prod.get('supplier_phone')) or user.get('phone', ''),
                'description': _clean(prod.get('description')),
                'supplier_id': user['_id'],
                'rating_avg': 0,
                'rating_count': 0,
                'created_at': datetime.datetime.utcnow(),
                'updated_at': datetime.datetime.utcnow(),
            }
            mongo.db.fertilizer_products.insert_one(product_doc)
            created_count += 1
        except Exception as e:
            errors.append(f'Row {idx + 1}: {str(e)}')

    return jsonify({
        'message': f'{created_count} products uploaded successfully',
        'created': created_count,
        'errors': errors
    })


# ===== ORDER NOTIFICATIONS =====
def _serialize_notification(notif):
    return {
        'id': str(notif['_id']),
        'user_id': str(notif.get('user_id', '')),
        'type': notif.get('type', 'order'),
        'title': notif.get('title', ''),
        'message': notif.get('message', ''),
        'order_id': str(notif.get('order_id', '')) if notif.get('order_id') else None,
        'read': notif.get('read', False),
        'created_at': str(notif.get('created_at', ''))
    }


@fertilizer_bp.route('/notifications', methods=['GET'])
@require_auth
def get_notifications():
    user = get_current_user()
    limit = int(request.args.get('limit', 20) or 20)
    notifications = list(mongo.db.fertilizer_notifications.find({
        'user_id': user['_id']
    }).sort('created_at', -1).limit(limit))
    
    unread_count = mongo.db.fertilizer_notifications.count_documents({
        'user_id': user['_id'],
        'read': False
    })
    
    return jsonify({
        'notifications': [_serialize_notification(n) for n in notifications],
        'unread_count': unread_count
    })


@fertilizer_bp.route('/notifications/<notif_id>/read', methods=['PUT'])
@require_auth
def mark_notification_read(notif_id):
    user = get_current_user()
    try:
        notif_obj_id = ObjectId(notif_id)
    except Exception:
        return jsonify({'error': 'Invalid notification id'}), 400
    
    notif = mongo.db.fertilizer_notifications.find_one({'_id': notif_obj_id})
    if not notif or str(notif.get('user_id')) != str(user['_id']):
        return jsonify({'error': 'Notification not found'}), 404
    
    mongo.db.fertilizer_notifications.update_one(
        {'_id': notif_obj_id},
        {'$set': {'read': True}}
    )
    return jsonify({'message': 'Notification marked as read'})


def _create_notification(user_id, notif_type, title, message, order_id=None):
    """Helper to create a notification"""
    try:
        doc = {
            'user_id': user_id,
            'type': notif_type,
            'title': title,
            'message': message,
            'order_id': order_id,
            'read': False,
            'created_at': datetime.datetime.utcnow()
        }
        mongo.db.fertilizer_notifications.insert_one(doc)
    except Exception as e:
        print(f'Failed to create notification: {e}')
