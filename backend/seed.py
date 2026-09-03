"""
seed.py — Populate MongoDB with demo equipment, worker, and fertilizer data for KrishiYantra.
Run once: python seed.py
"""

from pymongo import MongoClient
from werkzeug.security import generate_password_hash
import datetime
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/krishiyantra")
client = MongoClient(MONGO_URI)
db = client.krishiyantra

# ---- Clear existing demo data ----
print("Clearing existing data...")
for collection in [
    "users",
    "equipment",
    "rentals",
    "kamgar_profiles",
    "kamgar_jobs",
    "fertilizer_products",
    "fertilizer_orders",
]:
    db[collection].delete_many({})

# ---- Seed Users ----
print("Seeding users...")
users = [
    {
        "name": "Vivek Jadhav",
        "email": "rajesh@demo.com",
        "phone": "9699391891",
        "location": "Pune, Maharashtra",
        "password": generate_password_hash("password123"),
        "role": "owner",
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Yash Jadhav",
        "email": "yash@demo.com",
        "phone": "9876543211",
        "location": "Nashik, Maharashtra",
        "password": generate_password_hash("password123"),
        "role": "owner",
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Meena Jadhav",
        "email": "meena@demo.com",
        "phone": "9876543212",
        "location": "Nashik, Maharashtra",
        "password": generate_password_hash("password123"),
        "role": "renter",
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Ramesh Patil",
        "email": "ramesh.kamgar@demo.com",
        "phone": "9823456781",
        "location": "Sangli, Maharashtra",
        "password": generate_password_hash("password123"),
        "role": "kamgar",
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Shankar More",
        "email": "shankar.kamgar@demo.com",
        "phone": "9823456782",
        "location": "Kolhapur, Maharashtra",
        "password": generate_password_hash("password123"),
        "role": "kamgar",
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Anita Salve",
        "email": "anita.kamgar@demo.com",
        "phone": "9823456783",
        "location": "Nanded, Maharashtra",
        "password": generate_password_hash("password123"),
        "role": "kamgar",
        "created_at": datetime.datetime.utcnow()
    }
]
user_ids = db.users.insert_many(users).inserted_ids
print(f"  Inserted {len(user_ids)} users")

owner1_id = user_ids[0]
owner2_id = user_ids[1]
renter_id = user_ids[2]
worker1_id = user_ids[3]
worker2_id = user_ids[4]
worker3_id = user_ids[5]

# ---- Seed Equipment ----
print("Seeding equipment...")
equipment_list = [
    {
        "name": "Mahindra 575 DI Tractor",
        "category": "tractor",
        "price_per_day": 2500,
        "location": "Kolhapur, Maharashtra",
        "description": "Well-maintained Mahindra 575 DI, 47HP. Ideal for field prep, sowing, and transport. Rotavator attachment available.",
        "brand": "Mahindra",
        "year": 2020,
        "owner_name": "Vivek Jadhav",
        "owner_phone": "9699391891",
        "owner_id": owner1_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "John Deere 5310 Tractor",
        "category": "tractor",
        "price_per_day": 3200,
        "location": "Kolhapur, Maharashtra",
        "description": "Powerful John Deere 5310, 55HP. Perfect for heavy field operations and transportation.",
        "brand": "John Deere",
        "year": 2021,
        "owner_name": "Vivek Jadhav",
        "owner_phone": "9699391891",
        "owner_id": owner1_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Combine Harvester (Self-Propelled)",
        "category": "harvester",
        "price_per_day": 5500,
        "location": "Kolhapur, Maharashtra",
        "description": "Self-propelled combine harvester for wheat and paddy. Minimal crop loss, very efficient.",
        "brand": "CLAAS",
        "year": 2019,
        "owner_name": "Vivek Jadhav",
        "owner_phone": "9699391891",
        "owner_id": owner1_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Rotavator 7 ft",
        "category": "rotavator",
        "price_per_day": 1200,
        "location": "Kolhapur, Maharashtra",
        "description": "Heavy duty 7ft rotavator. Prepares seedbed with excellent soil tilth for all crops.",
        "brand": "Shaktiman",
        "year": 2022,
        "owner_name": "Vivek Jadhav",
        "owner_phone": "9699391891",
        "owner_id": owner1_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Power Sprayer 16L",
        "category": "sprayer",
        "price_per_day": 600,
        "location": "Kolhapur, Maharashtra",
        "description": "Battery-powered knapsack sprayer, 16L capacity. Ideal for pesticide and fertilizer application.",
        "brand": "Neptune",
        "year": 2023,
        "owner_name": "Vivek Jadhav",
        "owner_phone": "9699391891",
        "owner_id": owner1_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Paddy Thresher",
        "category": "thresher",
        "price_per_day": 1400,
        "location": "Kolhapur, Maharashtra",
        "description": "Efficient paddy thresher. Separates grain quickly with low breakage. Diesel powered.",
        "brand": "Agrimaster",
        "year": 2021,
        "owner_name": "Vivek Jadhav",
        "owner_phone": "9699391891",
        "owner_id": owner1_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "MB Plough 3 Furrow",
        "category": "plough",
        "price_per_day": 900,
        "location": "Sangli, Maharashtra",
        "description": "3-furrow MB plough for deep primary tillage. Suitable for heavy clay soils.",
        "brand": "Fieldking",
        "year": 2020,
        "owner_name": "Yash Jadhav",
        "owner_phone": "9876543211",
        "owner_id": owner2_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Seed Drill 9-Row",
        "category": "seeder",
        "price_per_day": 1100,
        "location": "Sangli, Maharashtra",
        "description": "9-row seed drill for precise sowing of soybean, wheat, gram. Uniform row spacing.",
        "brand": "Agro Master",
        "year": 2022,
        "owner_name": "Yash Jadhav",
        "owner_phone": "9876543211",
        "owner_id": owner2_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Diesel Water Pump 5HP",
        "category": "pump",
        "price_per_day": 550,
        "location": "Sangli, Maharashtra",
        "description": "5HP diesel water pump. High discharge rate for field irrigation. Easy to transport.",
        "brand": "Kirloskar",
        "year": 2021,
        "owner_name": "Yash Jadhav",
        "owner_phone": "9876543211",
        "owner_id": owner2_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Mini Power Tiller",
        "category": "tractor",
        "price_per_day": 1600,
        "location": "Sangli, Maharashtra",
        "description": "Versatile mini power tiller for small farms and hilly terrain. 7HP, lightweight.",
        "brand": "VST Shakti",
        "year": 2022,
        "owner_name": "Yash Jadhav",
        "owner_phone": "9876543211",
        "owner_id": owner2_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "Laser Land Leveler",
        "category": "tractor",
        "price_per_day": 3800,
        "location": "Sangli, Maharashtra",
        "description": "GPS-guided laser land leveler. Levels fields accurately for water-efficient irrigation.",
        "brand": "Trimble",
        "year": 2020,
        "owner_name": "Yash Jadhav",
        "owner_phone": "9876543211",
        "owner_id": owner2_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
    {
        "name": "John Deere Combine Harvester W70",
        "category": "harvester",
        "price_per_day": 4800,
        "location": "Sangli, Maharashtra",
        "description": "John Deere W70 combine for wheat, soybean, and sunflower. Excellent threshing quality.",
        "brand": "John Deere",
        "year": 2021,
        "owner_name": "Yash Jadhav",
        "owner_phone": "9876543211",
        "owner_id": owner2_id,
        "available": True,
        "created_at": datetime.datetime.utcnow()
    },
]

eq_ids = db.equipment.insert_many(equipment_list).inserted_ids
print(f"  Inserted {len(eq_ids)} equipment records")

# ---- Seed Worker Profiles ----
print("Seeding worker profiles...")
worker_profiles = [
    {
        "user_id": worker1_id,
        "name": "Ramesh Patil",
        "phone": "9823456781",
        "location": "Sangli, Maharashtra",
        "skills": ["field_work", "sowing", "harvesting", "tractor_operation"],
        "experience_years": 7,
        "availability": "Available for next 3 days",
        "hourly_rate": 260,
        "daily_rate": 2200,
        "description": "Experienced farm labourer specializing in sowing, transplanting, and combine support operations.",
        "photo_url": "",
        "available": True,
        "status": "active",
        "rating_avg": 4.7,
        "rating_count": 18,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow(),
    },
    {
        "user_id": worker2_id,
        "name": "Shankar More",
        "phone": "9823456782",
        "location": "Kolhapur, Maharashtra",
        "skills": ["spraying", "weeding", "crop_monitoring", "manual_labour"],
        "experience_years": 5,
        "availability": "Available immediately",
        "hourly_rate": 220,
        "daily_rate": 1800,
        "description": "Skilled in crop care, spraying, inter-cultivation, and seasonal farm maintenance work.",
        "photo_url": "",
        "available": True,
        "status": "active",
        "rating_avg": 4.5,
        "rating_count": 12,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow(),
    },
    {
        "user_id": worker3_id,
        "name": "Anita Salve",
        "phone": "9823456783",
        "location": "Nanded, Maharashtra",
        "skills": ["harvesting", "sorting", "field_support", "grading"],
        "experience_years": 4,
        "availability": "Available after 2 days",
        "hourly_rate": 240,
        "daily_rate": 1900,
        "description": "Reliable farm support professional focused on harvesting, sorting, and field logistics.",
        "photo_url": "",
        "available": False,
        "status": "active",
        "rating_avg": 4.6,
        "rating_count": 9,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow(),
    }
]
db.kamgar_profiles.insert_many(worker_profiles)
print(f"  Inserted {len(worker_profiles)} worker profiles")

# ---- Seed Worker Jobs ----
print("Seeding worker bookings...")
worker_profile_ids = list(db.kamgar_profiles.find({"user_id": {"$in": [worker1_id, worker2_id, worker3_id]}}))
worker_one_id = worker_profile_ids[0]["_id"] if worker_profile_ids else None

if worker_one_id:
    db.kamgar_jobs.insert_one({
        "worker_id": worker_one_id,
        "farmer_id": renter_id,
        "farmer_name": "Meena Jadhav",
        "worker_name": "Ramesh Patil",
        "location": "Miraj, Maharashtra",
        "job_type": "field_work",
        "title": "Sugarcane field maintenance",
        "description": "Need 2 workers for weed removal and bund maintenance for 2 days.",
        "start_date": "2026-09-03",
        "end_date": "2026-09-04",
        "work_hours": "8 hours/day",
        "estimated_cost": 4400,
        "payment_status": "pending",
        "status": "requested",
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow(),
    })
    print("  Inserted 1 sample worker booking")

# ---- Seed Fertilizer Products ----
print("Seeding fertilizer products...")
fertilizer_products = [
    {
        "name": "Urea 46% N",
        "category": "nitrogen",
        "brand": "IFFCO",
        "variant": "50kg bag",
        "price_per_bag": 280,
        "stock_available": 120,
        "location": "Nashik, Maharashtra",
        "supplier_name": "Yash Jadhav",
        "supplier_phone": "9876543211",
        "supplier_id": owner2_id,
        "description": "High purity nitrogen fertilizer for paddy, wheat, and sugarcane crop growth.",
        "rating_avg": 4.7,
        "rating_count": 23,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow(),
    },
    {
        "name": "DAP (18:46:0)",
        "category": "phosphorus",
        "brand": "Coromandel",
        "variant": "50kg bag",
        "price_per_bag": 1350,
        "stock_available": 75,
        "location": "Pune, Maharashtra",
        "supplier_name": "Vivek Jadhav",
        "supplier_phone": "9699391891",
        "supplier_id": owner1_id,
        "description": "Balanced phosphorus-rich fertilizer for root development and early plant vigor.",
        "rating_avg": 4.8,
        "rating_count": 30,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow(),
    },
    {
        "name": "Complex Fertilizer 20:20:20",
        "category": "balanced",
        "brand": "Nutrient Plus",
        "variant": "50kg bag",
        "price_per_bag": 980,
        "stock_available": 95,
        "location": "Sangli, Maharashtra",
        "supplier_name": "Yash Jadhav",
        "supplier_phone": "9876543211",
        "supplier_id": owner2_id,
        "description": "All-purpose NPK mix for vegetables, cotton, and cereal crops in nutrient-deficient soil.",
        "rating_avg": 4.6,
        "rating_count": 20,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow(),
    },
    {
        "name": "Potash MOP",
        "category": "potash",
        "brand": "Krishak Bharti",
        "variant": "50kg bag",
        "price_per_bag": 840,
        "stock_available": 80,
        "location": "Kolhapur, Maharashtra",
        "supplier_name": "Vivek Jadhav",
        "supplier_phone": "9699391891",
        "supplier_id": owner1_id,
        "description": "Potassium-rich fertilizer to increase crop resilience, fruit quality, and stress tolerance.",
        "rating_avg": 4.5,
        "rating_count": 16,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow(),
    },
    {
        "name": "Bio Organic Compost",
        "category": "organic",
        "brand": "GreenGold",
        "variant": "25kg bag",
        "price_per_bag": 430,
        "stock_available": 110,
        "location": "Nanded, Maharashtra",
        "supplier_name": "Vivek Jadhav",
        "supplier_phone": "9699391891",
        "supplier_id": owner1_id,
        "description": "Organic nutrient source for soil health improvement and long-term fertility building.",
        "rating_avg": 4.7,
        "rating_count": 18,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow(),
    }
]
product_ids = db.fertilizer_products.insert_many(fertilizer_products).inserted_ids
print(f"  Inserted {len(product_ids)} fertilizer products")

# ---- Seed Sample Fertilizer Order ----
print("Seeding sample fertilizer order...")
db.fertilizer_orders.insert_one({
    "product_id": product_ids[0],
    "product_name": "Urea 46% N",
    "farmer_id": renter_id,
    "farmer_name": "Meena Jadhav",
    "supplier_id": owner2_id,
    "supplier_name": "Yash Jadhav",
    "quantity": 4,
    "unit_price": 280,
    "total_amount": 1120,
    "delivery_location": "Nashik, Maharashtra",
    "delivery_date": "2026-09-07",
    "payment_status": "pending",
    "status": "requested",
    "created_at": datetime.datetime.utcnow(),
    "updated_at": datetime.datetime.utcnow(),
})
print("  Inserted 1 sample fertilizer order")

print("\n✅ Seeding complete!")
print("\nDemo Login Credentials:")
print("  Email: rajesh@demo.com  | Password: password123  (Owner)")
print("  Email: meena@demo.com   | Password: password123  (Renter)")
print("  Email: ramesh.kamgar@demo.com | Password: password123  (Kamgar)")
print("  Email: meena@demo.com   | Password: password123  (Renter)")
