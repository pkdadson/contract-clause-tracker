from datetime import datetime
from pydantic import BaseModel, Field
from typing import Literal

ContractType = Literal["NDA", "MSA", "DPA", "Employment", "Reseller", "Other"]

class ClauseTypeOut(BaseModel):
    id: str
    name: str
    description: str
    color_token: str
    sort_order: int
    model_config = {"from_attributes": True}

class SentenceOut(BaseModel):
    id: str
    idx: int
    text: str
    is_heading: bool
    clause_type_id: str | None
    model_config = {"from_attributes": True}

class DocumentListItem(BaseModel):
    id: str
    title: str
    party: str | None
    contract_type: ContractType | None
    uploaded_at: datetime
    modified_at: datetime
    sentence_count: int
    labeled_count: int
    clause_types_present: list[str]

class DocumentDetail(BaseModel):
    id: str
    title: str
    party: str | None
    contract_type: ContractType | None
    uploaded_at: datetime
    modified_at: datetime
    sentences: list[SentenceOut]
    model_config = {"from_attributes": True}

class LabelSetRequest(BaseModel):
    clause_type_id: str = Field(min_length=1)

class DocumentUpdateRequest(BaseModel):
    contract_type: ContractType | None

class SuggestionOut(BaseModel):
    id: str
    sentence_id: str
    clause_type_id: str
    confidence: float