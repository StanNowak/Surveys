#!/bin/bash
# Start development server for Avalanche Survey

echo "🏔️  Starting Avalanche Survey Development Server..."

# Add Node.js to PATH if needed
export PATH="/usr/local/n/versions/node/21.7.1/bin:$PATH"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js or check your PATH."
    exit 1
fi

# Start the server from project root to serve both public and src
echo "📡 Starting server on http://localhost:3000"
echo "🔗 Open http://localhost:3000/public/ in your browser to test the survey"
echo ""
echo "Press Ctrl+C to stop the server"

npx serve . -p 3000
