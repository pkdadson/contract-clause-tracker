from fastapi import APIRouter

from ..schemas import SuggestionOut

router = APIRouter(
    prefix="/api/documents/{document_id}/suggestions",
    tags=["suggestions"],
)


@router.get("", response_model=list[SuggestionOut])
def list_suggestions(document_id: str) -> list[SuggestionOut]:
    """Stub. The pair-programming session adds the labeller that fills this."""
    return []
