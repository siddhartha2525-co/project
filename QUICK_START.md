# 🚀 Quick Start Guide

Get your Real-Time Emotion & Engagement Detection System running in minutes!

## Prerequisites

- **Docker** (with Docker Compose)
- **Node.js 18+** (for local development)
- **Python 3.8+** (for local development)

## 🎯 Option 1: One-Click Setup (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd emotion-engagement-system

# Run the automated setup script
./setup.sh
```

The setup script will:
- ✅ Install all dependencies
- ✅ Create environment files
- ✅ Build Docker images
- ✅ Start all services
- ✅ Verify everything is working
- 🌐 Optionally open the app in your browser

## 🎯 Option 2: Manual Setup

### 1. Start Infrastructure Services

```bash
# Start database and Redis
docker-compose up -d postgres redis

# Wait for services to be ready
sleep 10
```

### 2. Set Up Backend

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp env.example .env

# Start the server
npm run dev
```

### 3. Set Up ML Service

```bash
cd ml-service

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp env.example .env

# Start the service
python app.py
```

### 4. Set Up Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

## 🌐 Access Your Application

Once everything is running:

- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **ML Service**: http://localhost:5001
- **Database**: localhost:5432
- **Redis**: localhost:6379

## 🎓 First Steps

1. **Open** http://localhost:3000
2. **Register** a new account (teacher or student)
3. **Login** to your account
4. **Create/Join** a learning session
5. **Start monitoring** engagement in real-time!

## 🔧 Development Commands

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f ml-service
docker-compose logs -f frontend

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Update and rebuild
docker-compose pull
docker-compose build --no-cache
docker-compose up -d
```

## 🐛 Troubleshooting

### Service Won't Start?

```bash
# Check service status
docker-compose ps

# Check logs
docker-compose logs [service-name]

# Restart service
docker-compose restart [service-name]
```

### Database Connection Issues?

```bash
# Check if database is running
docker exec emotion_db pg_isready -U emotion_user

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

### Port Already in Use?

```bash
# Check what's using the port
lsof -i :5000
lsof -i :3000
lsof -i :5001

# Kill the process or change ports in docker-compose.yml
```

## 📱 Features to Try

### For Teachers:
- Create learning sessions
- Monitor real-time engagement
- View student analytics
- Generate session reports

### For Students:
- Join learning sessions
- Allow camera access
- See your engagement level
- Participate in sessions

## 🔒 Security Notes

- Change `JWT_SECRET` in `backend/.env` for production
- Update database passwords in `docker-compose.yml`
- Enable HTTPS in production
- Set up proper firewall rules

## 📚 Next Steps

- [ ] Customize the emotion detection model
- [ ] Add more analytics features
- [ ] Integrate with LMS platforms
- [ ] Deploy to production
- [ ] Add user management features

## 🆘 Need Help?

- Check the logs: `docker-compose logs -f`
- Review the [README.md](README.md)
- Check the [System Design Document](System_Design_Document.md)
- Create an issue in the repository

---

**🎉 You're all set!** Your Real-Time Emotion & Engagement Detection System is now running and ready to enhance online learning experiences.
