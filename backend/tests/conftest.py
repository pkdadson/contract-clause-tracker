import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.dependencies import get_db
from app.main import app
from app import models  # noqa: F401  register models

@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    sess = TestingSession()
    # seed clause types
    from app.models import ClauseType
    for row in [
        ("liability","Limitation of Liability","x","--c-liability",1),
        ("termination","Termination for Convenience","x","--c-termination",2),
        ("confidential","Confidentiality","x","--c-confidential",3),
        ("payment","Payment Terms","x","--c-payment",6),
    ]:
        sess.add(ClauseType(id=row[0], name=row[1], description=row[2], color_token=row[3], sort_order=row[4]))
    sess.commit()
    try:
        yield sess
    finally:
        sess.close()

@pytest.fixture
def client(db_session):
    def override():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    app.dependency_overrides.clear()