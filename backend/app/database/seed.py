"""Local development seed data.

Creates:
  - a Super Admin account
  - one demo shop ("Demo Sarees") on a 14-day trial
  - a shop-owner account for that shop
  - 5 categories and ~30 realistic demo products, split between products
    "uploaded by" the shop owner and by the catalog team (SUPER_ADMIN), to
    exercise the created_by tracking the catalog-management service needs.

Idempotent: safe to run more than once. Existing rows (matched by the
same unique fields the DB enforces — email, slug, shop_id+name,
shop_id+product_code) are left alone rather than duplicated.

Usage:
    python -m app.database.seed

IMPORTANT: these credentials are for local development only and must
never be used, or left enabled, in a production deployment.
"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.database.session import SessionLocal
from app.models import (
    Category,
    Product,
    ProductImage,
    ProductStatus,
    Shop,
    SubscriptionStatus,
    User,
    UserRole,
)

SUPER_ADMIN_EMAIL = "admin@example.com"
SUPER_ADMIN_PASSWORD = "Admin123!"

DEMO_SHOP_NAME = "Demo Sarees"
DEMO_SHOP_SLUG = "demo-sarees"

DEMO_OWNER_EMAIL = "owner@example.com"
DEMO_OWNER_PASSWORD = "Owner123!"

CATEGORY_NAMES = [
    "Silk Sarees",
    "Cotton Sarees",
    "Designer Sarees",
    "Lehengas",
    "Dress Material",
]

# (category, product_code, name, price)
DEMO_PRODUCTS: list[tuple[str, str, str, str]] = [
    ("Silk Sarees", "BS1001", "Banarasi Silk Saree", "8500.00"),
    ("Silk Sarees", "BS1002", "Kanjivaram Silk Saree", "12500.00"),
    ("Silk Sarees", "BS1003", "Mysore Silk Saree", "6200.00"),
    ("Silk Sarees", "BS1004", "Tussar Silk Saree", "5400.00"),
    ("Silk Sarees", "BS1005", "Patola Silk Saree", "15800.00"),
    ("Silk Sarees", "BS1006", "Bhagalpuri Silk Saree", "4800.00"),
    ("Cotton Sarees", "CS2001", "Handloom Cotton Saree", "1800.00"),
    ("Cotton Sarees", "CS2002", "Chanderi Cotton Saree", "2600.00"),
    ("Cotton Sarees", "CS2003", "Bengal Cotton Saree", "2100.00"),
    ("Cotton Sarees", "CS2004", "Kota Doria Cotton Saree", "2400.00"),
    ("Cotton Sarees", "CS2005", "Maheshwari Cotton Saree", "3200.00"),
    ("Cotton Sarees", "CS2006", "Block Print Cotton Saree", "1950.00"),
    ("Designer Sarees", "DS3001", "Georgette Designer Saree", "4200.00"),
    ("Designer Sarees", "DS3002", "Net Embroidered Saree", "6800.00"),
    ("Designer Sarees", "DS3003", "Sequin Party Wear Saree", "7500.00"),
    ("Designer Sarees", "DS3004", "Organza Floral Saree", "5600.00"),
    ("Designer Sarees", "DS3005", "Crepe Printed Saree", "3800.00"),
    ("Designer Sarees", "DS3006", "Velvet Border Saree", "9200.00"),
    ("Lehengas", "LH4001", "Bridal Silk Lehenga", "22000.00"),
    ("Lehengas", "LH4002", "Georgette Party Lehenga", "9800.00"),
    ("Lehengas", "LH4003", "Net Embroidered Lehenga", "14500.00"),
    ("Lehengas", "LH4004", "Velvet Wedding Lehenga", "26500.00"),
    ("Lehengas", "LH4005", "Silk Blend Lehenga", "11200.00"),
    ("Lehengas", "LH4006", "Floral Print Lehenga", "7600.00"),
    ("Dress Material", "DM5001", "Cotton Salwar Suit Set", "1400.00"),
    ("Dress Material", "DM5002", "Anarkali Suit Set", "2800.00"),
    ("Dress Material", "DM5003", "Palazzo Suit Set", "2200.00"),
    ("Dress Material", "DM5004", "Straight Cut Suit Set", "1900.00"),
    ("Dress Material", "DM5005", "Embroidered Suit Set", "3600.00"),
    ("Dress Material", "DM5006", "Printed Kurti Fabric Set", "1200.00"),
]

# Cycle through statuses so the demo catalog isn't 100% "Available".
_STATUS_CYCLE = [
    ProductStatus.AVAILABLE,
    ProductStatus.AVAILABLE,
    ProductStatus.AVAILABLE,
    ProductStatus.SOLD,
    ProductStatus.AVAILABLE,
    ProductStatus.OUT_OF_STOCK,
]


def _placeholder_image(seed: str, width: int = 800, height: int = 1000) -> str:
    """A deterministic placeholder photo URL until real product photography
    is uploaded (either by the shop owner or the paid catalog service)."""
    return f"https://picsum.photos/seed/{seed}/{width}/{height}"


def seed_super_admin(db: Session) -> User:
    admin = db.query(User).filter(User.email == SUPER_ADMIN_EMAIL).first()
    if admin:
        print(f"  - Super admin already exists ({SUPER_ADMIN_EMAIL}), skipping.")
        return admin

    admin = User(
        name="Catalog Team Admin",
        email=SUPER_ADMIN_EMAIL,
        password_hash=hash_password(SUPER_ADMIN_PASSWORD),
        role=UserRole.SUPER_ADMIN,
        shop_id=None,
        is_active=True,
    )
    db.add(admin)
    db.flush()
    print(f"  - Created super admin: {SUPER_ADMIN_EMAIL}")
    return admin


def seed_demo_shop(db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.slug == DEMO_SHOP_SLUG).first()
    if shop:
        print(f"  - Demo shop already exists ({DEMO_SHOP_SLUG}), skipping.")
        return shop

    today = date.today()
    shop = Shop(
        name=DEMO_SHOP_NAME,
        slug=DEMO_SHOP_SLUG,
        logo_url=None,
        description="A curated collection of sarees, lehengas and dress material.",
        phone="+91 98765 43210",
        address="12 MG Road",
        city="Bengaluru",
        website=None,
        is_active=True,
        trial_start_date=today,
        trial_end_date=today + timedelta(days=14),
        subscription_status=SubscriptionStatus.TRIAL,
    )
    db.add(shop)
    db.flush()
    print(f"  - Created demo shop: {DEMO_SHOP_NAME} ({DEMO_SHOP_SLUG})")
    return shop


def seed_demo_owner(db: Session, shop: Shop) -> User:
    owner = db.query(User).filter(User.email == DEMO_OWNER_EMAIL).first()
    if owner:
        print(f"  - Demo shop owner already exists ({DEMO_OWNER_EMAIL}), skipping.")
        return owner

    owner = User(
        name="Demo Sarees Owner",
        email=DEMO_OWNER_EMAIL,
        password_hash=hash_password(DEMO_OWNER_PASSWORD),
        role=UserRole.SHOP_OWNER,
        shop_id=shop.id,
        is_active=True,
    )
    db.add(owner)
    db.flush()
    print(f"  - Created demo shop owner: {DEMO_OWNER_EMAIL}")
    return owner


def seed_categories(db: Session, shop: Shop) -> dict[str, Category]:
    existing = {c.name: c for c in db.query(Category).filter(Category.shop_id == shop.id)}
    categories = dict(existing)

    for order, name in enumerate(CATEGORY_NAMES):
        if name in categories:
            continue
        category = Category(
            shop_id=shop.id,
            name=name,
            description=f"{name} available at {shop.name}.",
            display_order=order,
            is_active=True,
        )
        db.add(category)
        db.flush()
        categories[name] = category
        print(f"  - Created category: {name}")

    return categories


def seed_products(
    db: Session, shop: Shop, owner: User, admin: User, categories: dict[str, Category]
) -> None:
    existing_codes = {
        p.product_code
        for p in db.query(Product).filter(Product.shop_id == shop.id)
        if p.product_code
    }

    created_count = 0
    for index, (category_name, code, name, price) in enumerate(DEMO_PRODUCTS):
        if code in existing_codes:
            continue

        category = categories[category_name]
        status = _STATUS_CYCLE[index % len(_STATUS_CYCLE)]
        # ~1 in 5 products credited to the catalog team, to demonstrate the
        # created_by tracking the paid catalog-management service relies on.
        creator = admin if index % 5 == 0 else owner

        product = Product(
            shop_id=shop.id,
            category_id=category.id,
            product_code=code,
            name=name,
            description=(
                f"{name} from our {category_name.lower()} collection. "
                "Traditional craftsmanship, carefully sourced, ready to wear "
                "for festive and special occasions."
            ),
            price=price,
            status=status,
            primary_image_url=_placeholder_image(code),
            created_by=creator.id,
        )
        db.add(product)
        db.flush()

        db.add_all(
            [
                ProductImage(
                    product_id=product.id,
                    image_url=_placeholder_image(f"{code}-2"),
                    display_order=1,
                ),
                ProductImage(
                    product_id=product.id,
                    image_url=_placeholder_image(f"{code}-3"),
                    display_order=2,
                ),
            ]
        )
        created_count += 1

    if created_count:
        print(f"  - Created {created_count} demo products (with gallery images).")
    else:
        print("  - Demo products already exist, skipping.")


def seed() -> None:
    from app.utils.config import get_settings

    if get_settings().environment == "production":
        print("ERROR: The seed script must NOT be run against a production database.")
        print("Use 'python -m app.database.create_admin' to create a production admin account.")
        return

    db = SessionLocal()
    try:
        print("Seeding local development data...")
        admin = seed_super_admin(db)
        shop = seed_demo_shop(db)
        owner = seed_demo_owner(db, shop)
        categories = seed_categories(db, shop)
        seed_products(db, shop, owner, admin, categories)
        db.commit()
        print("Done.\n")
        print("=" * 60)
        print("DEV-ONLY DEMO CREDENTIALS -- do not use in production")
        print("=" * 60)
        print(f"Super Admin : {SUPER_ADMIN_EMAIL} / {SUPER_ADMIN_PASSWORD}")
        print(f"Shop Owner  : {DEMO_OWNER_EMAIL} / {DEMO_OWNER_PASSWORD}")
        print(f"Demo shop   : /shop/{DEMO_SHOP_SLUG}")
        print("=" * 60)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
