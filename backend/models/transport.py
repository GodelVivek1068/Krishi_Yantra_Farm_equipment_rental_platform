"""
Transport model schema reference (MongoDB — schemaless).

Collection: transport_vehicles
Fields:
  - name           : str
  - vehicle_type   : str ('truck'|'van'|'picker'|'trailer'|'container'|'tanker'|'other')
  - capacity       : str (e.g. '5 tons', '500 kg')
  - rate_per_km    : int (in INR, between MIN_RATE_PER_KM and MAX_RATE_PER_KM)
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
    'rate_per_km': int,
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

MIN_RATE_PER_KM = 100
MAX_RATE_PER_KM = 300
