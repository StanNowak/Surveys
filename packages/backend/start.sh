#!/bin/bash
# Start FastAPI server

cd "$(dirname "$0")"

# Activate virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install fastapi uvicorn[standard] psycopg2-binary python-dotenv pydantic pydantic-settings python-jose[cryptography] python-multipart -q
else
    source venv/bin/activate
fi

# Set PYTHONPATH
export PYTHONPATH="$(pwd)/..:$PYTHONPATH"

# Start server
echo "Starting FastAPI server on http://localhost:8000"
echo "API docs: http://localhost:8000/docs"
uvicorn backend.main:app --reload --port 8000 --host 127.0.0.1

