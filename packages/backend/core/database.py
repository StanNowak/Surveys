"""
Database Connection Module
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
import os
from dotenv import load_dotenv

load_dotenv()

# Database connection string
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/surveys"
)

# Lazy initialization - only create engine when needed
_engine = None
_SessionLocal = None

def get_engine():
    """Get or create database engine (lazy initialization)"""
    global _engine
    if _engine is None:
        try:
            _engine = create_engine(DATABASE_URL, pool_pre_ping=True)
            # Test connection
            with _engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as e:
            print(f"Warning: Could not connect to database: {e}")
            print("Database operations will fail, but API will start")
            import traceback
            traceback.print_exc()
            # Create a dummy engine that will fail on use
            _engine = None
    return _engine

def get_session_local():
    """Get or create session maker (lazy initialization)"""
    global _SessionLocal
    if _SessionLocal is None:
        engine = get_engine()
        if engine:
            _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        else:
            # Return None if no engine
            return None
    return _SessionLocal


@contextmanager
def get_db():
    """
    Database session context manager.
    Usage:
        with get_db() as db:
            # use db
    """
    SessionLocal = get_session_local()
    if SessionLocal is None:
        raise RuntimeError("Database not available. Check connection.")
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_db_session():
    """
    Get a database session (for dependency injection).
    """
    SessionLocal = get_session_local()
    if SessionLocal is None:
        raise RuntimeError("Database not available. Check connection.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

