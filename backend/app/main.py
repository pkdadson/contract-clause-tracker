import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import clause_types, documents, health, labels, suggestions

app = FastAPI(
    title="Clause Tracker API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

_default_origins = [
    "http://localhost:4200",
    "https://contract-clause-tracker.vercel.app",
]
_extra = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    health.router,
    clause_types.router,
    documents.router,
    labels.router,
    suggestions.router,
):
    app.include_router(router)
