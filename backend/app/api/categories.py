"""Shop-scoped category CRUD (Phase 4).

Mounted at /api/shops/{shop_id}/categories. `shop_id` always comes from the
URL path, never trusted from the request body -- every endpoint resolves
the caller via `require_shop_access`, which 404s a shop owner attempting
another shop's id and lets a super admin through for any shop (the
existing `verify_shop_ownership` pattern from Phase 2/3).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_shop_access
from app.database.session import get_db
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.services import category as category_service

router = APIRouter(prefix="/api/shops/{shop_id}/categories", tags=["categories"])


def _to_read(category, product_count: int) -> CategoryRead:
    return CategoryRead(
        id=category.id,
        shop_id=category.shop_id,
        name=category.name,
        description=category.description,
        display_order=category.display_order,
        is_active=category.is_active,
        product_count=product_count,
        created_at=category.created_at,
        updated_at=category.updated_at,
    )


def _get_category_or_404(db: Session, shop_id: int, category_id: int):
    category = category_service.get_category(db, shop_id, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
    return category


@router.get("", response_model=list[CategoryRead])
def list_categories(
    shop_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_access),
) -> list[CategoryRead]:
    return [_to_read(category, count) for category, count in category_service.list_categories(db, shop_id)]


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    shop_id: int,
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shop_access),
) -> CategoryRead:
    try:
        category = category_service.create_category(db, shop_id, payload, current_user)
        db.commit()
    except category_service.CategoryNameTakenError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _to_read(category, 0)


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    shop_id: int,
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shop_access),
) -> CategoryRead:
    category = _get_category_or_404(db, shop_id, category_id)
    try:
        category = category_service.update_category(db, category, payload, current_user)
        db.commit()
    except category_service.CategoryNameTakenError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    count = category_service.get_category_product_count(db, category.id)
    return _to_read(category, count)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    shop_id: int,
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shop_access),
) -> None:
    category = _get_category_or_404(db, shop_id, category_id)
    try:
        category_service.delete_category(db, category, current_user)
        db.commit()
    except category_service.CategoryHasProductsError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
