# Real-Time Emotion & Engagement Detection System

A sophisticated web application that monitors student engagement during online learning sessions using computer vision and deep learning.

## 🚀 Features

- **Real-time Emotion Detection**: CNN-based facial expression recognition
- **Live Engagement Analytics**: Real-time dashboard for teachers
- **WebRTC Integration**: Seamless video capture from students
- **Responsive Dashboard**: Beautiful React-based interface with charts
- **Session Management**: Complete learning session lifecycle
- **Post-session Reports**: Detailed analytics and insights

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **ML Service**: Python + TensorFlow + OpenCV
- **Database**: PostgreSQL + Redis
- **Real-time**: WebSocket connections for live updates

## 📋 Prerequisites

- Node.js 18+ 
- Python 3.8+
- PostgreSQL 13+
- Redis 6+
- Docker (optional)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd emotion-engagement-system
```

### 2. Install Dependencies

#### Frontend
```bash
cd frontend
npm install
```

#### Backend
```bash
cd backend
npm install
```

#### ML Service
```bash
cd ml-service
pip install -r requirements.txt
```

### 3. Environment Setup

#### Backend (.env)
```env
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/emotion_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
ML_SERVICE_URL=http://localhost:5001
```

#### ML Service (.env)
```env
PORT=5001
MODEL_PATH=./models/emotion_model.h5
DATABASE_URL=postgresql://username:password@localhost:5432/emotion_db
```

### 4. Database Setup
```bash
# Create database
createdb emotion_db

# Run migrations
cd backend
npm run migrate
```

### 5. Start Services

#### Terminal 1: Backend
```bash
cd backend
npm run dev
```

#### Terminal 2: ML Service
```bash
cd ml-service
python app.py
```

#### Terminal 3: Frontend
```bash
cd frontend
npm start
```

## 🎯 Usage

### For Teachers
1. Login to the dashboard
2. Create a new learning session
3. Share the session link with students
4. Monitor real-time engagement metrics
5. View post-session reports

### For Students
1. Join session using the provided link
2. Allow camera access for engagement tracking
3. Participate normally - tracking happens automatically

## 📊 Dashboard Features

- **Real-time Engagement Graph**: Live engagement scores
- **Student Status**: Individual student engagement levels
- **Emotion Distribution**: Current emotion breakdown
- **Session Timeline**: Engagement trends over time
- **Alerts**: Notifications for disengaged students

## 🔧 Development

### Project Structure
```
emotion-engagement-system/
├── frontend/          # React application
├── backend/           # Node.js API server
├── ml-service/        # Python ML service
├── database/          # Database migrations
├── docs/             # Documentation
└── docker/           # Docker configuration
```

### Available Scripts

#### Backend
- `npm run dev`: Development server with hot reload
- `npm run build`: Production build
- `npm run test`: Run test suite
- `npm run migrate`: Run database migrations

#### Frontend
- `npm start`: Development server
- `npm run build`: Production build
- `npm run test`: Run test suite

## 🚀 Deployment

### Docker Deployment
```bash
docker-compose up -d
```

### Manual Deployment
1. Build frontend: `npm run build`
2. Set production environment variables
3. Start backend and ML services
4. Configure reverse proxy (nginx)

## 📈 Performance

- **Latency**: < 1 second per frame processing
- **Concurrent Users**: 50+ students per session
- **Uptime**: 99.9% availability target
- **Accuracy**: 80%+ emotion detection accuracy

## 🔒 Security

- JWT-based authentication
- Role-based access control
- TLS encryption for all data
- No permanent video storage
- GDPR compliant data handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in `/docs`
- Review the API documentation

## 🎉 Acknowledgments

- FER-2013 dataset for emotion recognition training
- OpenCV and TensorFlow communities
- WebRTC standards and implementations
