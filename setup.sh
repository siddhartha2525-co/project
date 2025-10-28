#!/bin/bash

# Real-Time Emotion & Engagement Detection System Setup Script
# This script will help you set up and run the complete application

set -e

echo "🚀 Setting up Real-Time Emotion & Engagement Detection System"
echo "=============================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are available"

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs
mkdir -p ml-service/models
mkdir -p frontend/build

# Set up environment files
echo "⚙️  Setting up environment files..."

# Backend environment
if [ ! -f backend/.env ]; then
    cat > backend/.env << EOF
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://emotion_user:emotion_password@localhost:5432/emotion_db
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# ML Service Configuration
ML_SERVICE_URL=http://localhost:5001
ML_SERVICE_TIMEOUT=10000

# Security Configuration
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/app.log

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Session Configuration
SESSION_SECRET=your-session-secret-key
SESSION_TIMEOUT=3600000
EOF
    echo "✅ Created backend/.env"
else
    echo "ℹ️  backend/.env already exists"
fi

# ML Service environment
if [ ! -f ml-service/.env ]; then
    cat > ml-service/.env << EOF
# ML Service Configuration
PORT=5001
MODEL_PATH=./models/emotion_model.h5
DATABASE_URL=postgresql://emotion_user:emotion_password@localhost:5432/emotion_db
REDIS_URL=redis://localhost:6379
FLASK_ENV=development
EOF
    echo "✅ Created ml-service/.env"
else
    echo "ℹ️  ml-service/.env already exists"
fi

# Frontend environment
if [ ! -f frontend/.env ]; then
    cat > frontend/.env << EOF
# Frontend Configuration
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ML_SERVICE_URL=http://localhost:5001
REACT_APP_SOCKET_URL=http://localhost:5000
EOF
    echo "✅ Created frontend/.env"
else
    echo "ℹ️  frontend/.env already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."

# Backend dependencies
echo "   Installing backend dependencies..."
cd backend
npm install
cd ..

# Frontend dependencies
echo "   Installing frontend dependencies..."
cd frontend
npm install
cd ..

# ML Service dependencies
echo "   Installing ML service dependencies..."
cd ml-service
pip install -r requirements.txt
cd ..

echo "✅ Dependencies installed"

# Build Docker images
echo "🐳 Building Docker images..."
docker-compose build

echo "✅ Docker images built"

# Start services
echo "🚀 Starting services..."
docker-compose up -d

echo "✅ Services started"

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🔍 Checking service health..."

# Check backend
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
fi

# Check ML service
if curl -f http://localhost:5001/health > /dev/null 2>&1; then
    echo "✅ ML Service is healthy"
else
    echo "❌ ML Service health check failed"
fi

# Check database
if docker exec emotion_db pg_isready -U emotion_user > /dev/null 2>&1; then
    echo "✅ Database is ready"
else
    echo "❌ Database is not ready"
fi

# Check Redis
if docker exec emotion_redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📱 Your application is now running at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000"
echo "   ML Service: http://localhost:5001"
echo ""
echo "🗄️  Database:"
echo "   PostgreSQL: localhost:5432"
echo "   Redis: localhost:6379"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart services: docker-compose restart"
echo "   Update services: docker-compose pull && docker-compose up -d"
echo ""
echo "📚 Next steps:"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Register a new account (teacher or student)"
echo "   3. Create a learning session (if teacher)"
echo "   4. Join a session (if student)"
echo "   5. Start monitoring engagement!"
echo ""
echo "⚠️  Important notes:"
echo "   - Change the JWT_SECRET in backend/.env for production"
echo "   - The ML service uses a placeholder model for demonstration"
echo "   - All data is stored locally in Docker volumes"
echo "   - Check logs/ directory for application logs"
echo ""

# Optional: Open browser
read -p "🌐 Would you like to open the application in your browser? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open http://localhost:3000
    elif command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    else
        echo "Please open http://localhost:3000 in your browser"
    fi
fi

echo ""
echo "🎯 Happy coding! If you encounter any issues, check the logs with:"
echo "   docker-compose logs -f [service_name]"
