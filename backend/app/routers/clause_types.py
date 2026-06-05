from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..dependencies import get_db
from ..models import ClauseType
from ..schemas import ClauseTypeOut

router = APIRouter(prefix="/api/clause-types", tags=["clause-types"])

@router.get("", response_model=list[ClauseTypeOut])
def list_clause_types(db: Session = Depends(get_db)) -> list[ClauseType]:
    return db.query(ClauseType).order_by(ClauseType.sort_order).all()