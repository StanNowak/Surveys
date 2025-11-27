#!/bin/bash
# Stop all test servers

echo "Stopping servers..."

# Stop FastAPI
pkill -f "uvicorn backend.main" 2>/dev/null && echo "✅ FastAPI stopped" || echo "⚠️  FastAPI not running"

# Stop Frontend
pkill -f "serve" 2>/dev/null && echo "✅ Frontend stopped" || echo "⚠️  Frontend not running"

echo ""
echo "All servers stopped."

