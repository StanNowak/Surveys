"""
Database Connection Module
Simplified to use psycopg2 directly (no SQLAlchemy)
"""

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import os
from dotenv import load_dotenv

load_dotenv()

# Database connection string
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/surveys"
)

# Connection pool (lazy initialization)
_connection_pool = None


def get_connection_pool():
    """Get or create database connection pool (lazy initialization)"""
    global _connection_pool
    if _connection_pool is None:
        try:
            _connection_pool = psycopg2.pool.SimpleConnectionPool(
                1, 20,  # min 1, max 20 connections
                dsn=DATABASE_URL
            )
            # Test connection
            conn = _connection_pool.getconn()
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            _connection_pool.putconn(conn)
        except Exception as e:
            print(f"Warning: Could not connect to database: {e}")
            print("Database operations will fail, but API will start")
            import traceback
            traceback.print_exc()
            _connection_pool = None
    return _connection_pool


@contextmanager
def get_db():
    """
    Database connection context manager.
    Usage:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT ...")
            conn.commit()
    """
    pool = get_connection_pool()
    if pool is None:
        raise RuntimeError("Database not available. Check connection.")
    
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def get_db_connection():
    """
    Get a database connection (for dependency injection in FastAPI).
    Returns a generator that yields a connection.
    """
    pool = get_connection_pool()
    if pool is None:
        raise RuntimeError("Database not available. Check connection.")
    
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)
