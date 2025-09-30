#!/bin/bash

# Production Deployment Script for Sarvam AI VideoSDK
echo "🚀 Starting production deployment..."

# Set environment variables
export NODE_ENV=production
export PYTHON_ENV=production

# Frontend deployment
echo "📦 Building frontend..."
cd web
npm ci --production
npm run build --configuration production

if [ $? -eq 0 ]; then
    echo "✅ Frontend build successful"
else
    echo "❌ Frontend build failed"
    exit 1
fi

# Backend deployment
echo "🐍 Setting up backend..."
cd ../enterprise_app

# Install Python dependencies
pip install -r requirements.txt

# Run database migrations (if any)
echo "🗄️ Running database migrations..."
# alembic upgrade head

# Start backend server
echo "🔄 Starting backend server..."
python main.py &

# Wait for backend to start
sleep 5

# Test backend health
echo "🏥 Testing backend health..."
curl -f http://localhost:8000/api/v1/health || {
    echo "❌ Backend health check failed"
    exit 1
}

echo "✅ Backend is healthy"

# Serve frontend (using nginx or similar)
echo "🌐 Serving frontend..."
cd ../web
npx serve -s dist -l 3000 &

echo "🎉 Deployment completed successfully!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "WebSocket: ws://localhost:8000/ws"
