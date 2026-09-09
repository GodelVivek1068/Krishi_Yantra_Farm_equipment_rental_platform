"""
Transport model schema reference (MongoDB — schemaless).

Collection: transport_vehicles
Fields:
  - name           : str
  - vehicle_type   : str ('truck'|'van'|'picker'|'trailer'|'container'|'tanker'|'other')
  - capacity       : str (e.g. '5 tons', '500 kg')
  - price_per_day  : int (in INR)
  - location       : str
  - city           : str
  - district       : str
  - latitude       : float
  - longitude      : float
  - description    : str
  - owner_name     : str
  - owner_phone    : str
  - owner_id       : ObjectId (ref: users)
  - available      : bool
  - created_at     : datetime
"""

TRANSPORT_SCHEMA = {
    'name': str,
    'vehicle_type': str,
    'capacity': str,
    'price_per_day': int,
    'location': str,
    'city': str,
    'district': str,
    'latitude': float,
    'longitude': float,
    'description': str,
    'owner_name': str,
    'owner_phone': str,
    'owner_id': 'ObjectId',
    'available': bool,
    'created_at': 'datetime'
}

VALID_VEHICLE_TYPES = ['truck', 'van', 'picker', 'trailer', 'container', 'tanker', 'other']
