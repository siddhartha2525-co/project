# System Design Document (SDD)
## Real-Time Emotion & Engagement Detection System for Online Classes

---

## 1. Executive Summary

This document provides the technical architecture and design specifications for the Real-Time Emotion and Engagement Detection System. The system leverages computer vision, deep learning, and real-time analytics to monitor student engagement during online learning sessions.

---

## 2. System Overview

### 2.1 System Context
The system operates as a middleware layer between online learning platforms (Zoom, Google Meet, Teams) and educational institutions, providing real-time engagement analytics without disrupting the learning experience.

### 2.2 System Boundaries
- **Input**: Student video streams via WebRTC
- **Processing**: Real-time emotion detection and engagement scoring
- **Output**: Teacher dashboard analytics and alerts
- **Storage**: Session data and engagement metrics

---

## 3. Use Case Analysis

### 3.1 Primary Use Cases

#### UC1: Start Learning Session
- **Actor**: Teacher
- **Precondition**: System is running, students are connected
- **Main Flow**:
  1. Teacher initiates session
  2. System begins video capture from all students
  3. Emotion detection starts processing frames
  4. Dashboard displays real-time metrics
- **Postcondition**: Session is active, analytics are running

#### UC2: Monitor Student Engagement
- **Actor**: Teacher
- **Precondition**: Session is active
- **Main Flow**:
  1. Teacher views dashboard
  2. System displays real-time engagement scores
  3. Alerts are shown for disengaged students
  4. Teacher receives recommendations
- **Postcondition**: Teacher has actionable insights

#### UC3: Generate Session Report
- **Actor**: Teacher
- **Precondition**: Session has ended
- **Main Flow**:
  1. Teacher requests session report
  2. System aggregates all session data
  3. Report is generated with insights
  4. Report is displayed/downloaded
- **Postcondition**: Session analytics are available

### 3.2 Secondary Use Cases
- **UC4**: Configure System Settings
- **UC5**: Manage Student Accounts
- **UC6**: Export Data for Analysis

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Student      │    │   Teacher       │    │   Admin         │
│   Interface    │    │   Dashboard     │    │   Panel         │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      API Gateway         │
                    │    (Load Balancer)       │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      Web Application     │
                    │    (React + Node.js)     │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      ML Service          │
                    │   (Python + TensorFlow)  │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      Database            │
                    │    (PostgreSQL)          │
                    └───────────────────────────┘
```

### 4.2 Component Architecture

#### Frontend Layer
- **React Application**: Main user interface
- **WebRTC Client**: Video capture and streaming
- **Real-time Updates**: WebSocket connections for live data

#### Backend Layer
- **API Gateway**: Request routing and authentication
- **User Service**: Authentication and user management
- **Session Service**: Learning session management
- **Analytics Service**: Data processing and insights

#### ML Layer
- **Emotion Detection Service**: CNN model inference
- **Video Processing**: Frame extraction and preprocessing
- **Model Management**: Model versioning and updates

#### Data Layer
- **Primary Database**: PostgreSQL for structured data
- **Cache Layer**: Redis for session data and real-time metrics
- **File Storage**: AWS S3 for video recordings and reports

---

## 5. Data Design

### 5.1 Entity Relationship Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Users    │    │  Sessions   │    │ Engagement  │
│             │    │             │    │  Metrics    │
├─────────────┤    ├─────────────┤    ├─────────────┤
│ id (PK)    │    │ id (PK)     │    │ id (PK)    │
│ email      │    │ teacher_id  │    │ session_id │
│ name       │    │ start_time  │    │ student_id │
│ role       │    │ end_time    │    │ timestamp  │
│ created_at │    │ status      │    │ emotion    │
└─────────────┘    └─────────────┘    │ confidence │
         │                │           │ engagement │
         │                │           └─────────────┘
         │                │                   │
         └────────────────┼───────────────────┘
                          │
                ┌─────────▼─────────┐
                │   SessionUsers    │
                ├───────────────────┤
                │ session_id (PK)  │
                │ user_id (PK)     │
                │ role             │
                │ joined_at        │
                └───────────────────┘
```

### 5.2 Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('teacher', 'student', 'admin') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Sessions Table
```sql
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status ENUM('active', 'ended', 'cancelled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Engagement Metrics Table
```sql
CREATE TABLE engagement_metrics (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    student_id INTEGER REFERENCES users(id),
    timestamp TIMESTAMP NOT NULL,
    emotion VARCHAR(50) NOT NULL,
    confidence DECIMAL(5,4) NOT NULL,
    engagement_score DECIMAL(3,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Data Flow Design

### 6.1 Real-Time Data Flow

```
Student Video Stream
        │
        ▼
┌─────────────────┐
│  WebRTC Client │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Frame Extractor │ ← Extract frames every 100ms
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Emotion Model   │ ← CNN inference
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Engagement      │ ← Calculate engagement score
│ Calculator      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Real-time       │ ← WebSocket broadcast
│ Analytics       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Teacher         │ ← Dashboard updates
│ Dashboard       │
└─────────────────┘
```

### 6.2 Batch Processing Flow

```
Session Data
    │
    ▼
┌─────────────┐
│ Data        │ ← Aggregate session metrics
│ Aggregator  │
└─────────────┘
    │
    ▼
┌─────────────┐
│ Report      │ ← Generate insights
│ Generator   │
└─────────────┘
    │
    ▼
┌─────────────┐
│ Analytics   │ ← Store processed data
│ Database    │
└─────────────┘
```

---

## 7. Interface Design

### 7.1 API Endpoints

#### Authentication
```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
```

#### Sessions
```
GET    /api/sessions
POST   /api/sessions
GET    /api/sessions/{id}
PUT    /api/sessions/{id}
DELETE /api/sessions/{id}
```

#### Engagement Metrics
```
GET /api/sessions/{id}/metrics
GET /api/sessions/{id}/realtime
POST /api/sessions/{id}/metrics
```

#### Reports
```
GET /api/sessions/{id}/report
GET /api/sessions/{id}/export
```

### 7.2 WebSocket Events

```javascript
// Client to Server
'join_session'
'leave_session'
'request_metrics'

// Server to Client
'session_update'
'metrics_update'
'engagement_alert'
'student_status_change'
```

---

## 8. Security Design

### 8.1 Authentication & Authorization
- **JWT Tokens**: Secure session management
- **Role-based Access**: Teacher, Student, Admin permissions
- **Session Validation**: Verify user participation in sessions

### 8.2 Data Protection
- **TLS Encryption**: All data in transit
- **Video Privacy**: No permanent storage of raw video
- **Data Anonymization**: Aggregate metrics only
- **GDPR Compliance**: User consent and data deletion

### 8.3 API Security
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Sanitize all inputs
- **CORS Policy**: Restrict cross-origin requests

---

## 9. Performance Design

### 9.1 Scalability Considerations
- **Horizontal Scaling**: Multiple ML service instances
- **Load Balancing**: Distribute requests across services
- **Caching Strategy**: Redis for frequently accessed data
- **Database Optimization**: Indexing and query optimization

### 9.2 Performance Targets
- **Latency**: < 1 second per frame processing
- **Throughput**: Support 50+ concurrent students
- **Availability**: 99.9% uptime
- **Response Time**: < 200ms for API calls

### 9.3 Monitoring & Metrics
- **Application Metrics**: Response times, error rates
- **System Metrics**: CPU, memory, network usage
- **Business Metrics**: Engagement scores, session duration
- **Alerting**: Automated notifications for issues

---

## 10. Deployment Architecture

### 10.1 Infrastructure Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CDN          │    │   Load          │    │   Auto Scaling  │
│   (CloudFront) │    │   Balancer      │    │   Group         │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      Application         │
                    │      Load Balancer       │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Web Application        │
                    │   (EC2 Auto Scaling)     │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   ML Services            │
                    │   (EC2 GPU Instances)    │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Database               │
                    │   (RDS PostgreSQL)       │
                    └───────────────────────────┘
```

### 10.2 Container Strategy
- **Docker Containers**: Consistent deployment
- **Kubernetes**: Container orchestration (optional)
- **Service Mesh**: Inter-service communication
- **CI/CD Pipeline**: Automated deployment

---

## 11. Testing Strategy

### 11.1 Testing Levels
- **Unit Testing**: Individual component testing
- **Integration Testing**: Service interaction testing
- **System Testing**: End-to-end functionality
- **Performance Testing**: Load and stress testing

### 11.2 Test Data
- **Synthetic Data**: Generated test scenarios
- **Anonymized Data**: Real data with PII removed
- **Edge Cases**: Boundary condition testing

---

## 12. Risk Assessment & Mitigation

### 12.1 Technical Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|------------|
| Model Accuracy | Medium | High | Regular retraining, ensemble models |
| Scalability Issues | Low | High | Load testing, auto-scaling |
| Data Privacy | Medium | High | Encryption, access controls |

### 12.2 Operational Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|------------|
| Service Outages | Low | Medium | Monitoring, redundancy |
| Performance Degradation | Medium | Medium | Performance testing, optimization |
| Security Breaches | Low | High | Security audits, penetration testing |

---

## 13. Implementation Plan

### 13.1 Development Phases

#### Phase 1: Foundation (Weeks 1-3)
- Project setup and environment configuration
- Database design and implementation
- Basic API structure

#### Phase 2: Core ML (Weeks 4-6)
- Emotion detection model development
- Video processing pipeline
- ML service implementation

#### Phase 3: Backend (Weeks 7-8)
- Complete API implementation
- Real-time data processing
- Authentication and security

#### Phase 4: Frontend (Weeks 9-10)
- Teacher dashboard development
- Real-time updates and charts
- User interface optimization

#### Phase 5: Integration (Week 11)
- End-to-end testing
- Performance optimization
- Security validation

#### Phase 6: Deployment (Week 12)
- Production deployment
- Monitoring setup
- Documentation completion

### 13.2 Technology Stack

#### Frontend
- **Framework**: React 18
- **State Management**: Redux Toolkit
- **Charts**: Recharts/D3.js
- **Real-time**: Socket.io-client
- **Video**: WebRTC API

#### Backend
- **Runtime**: Node.js/Python
- **Framework**: Express.js/Flask
- **Database**: PostgreSQL
- **Cache**: Redis
- **Message Queue**: RabbitMQ

#### ML Services
- **Framework**: TensorFlow/PyTorch
- **Computer Vision**: OpenCV
- **Model Serving**: TensorFlow Serving
- **Data Processing**: NumPy, Pandas

#### Infrastructure
- **Cloud**: AWS/GCP
- **Containerization**: Docker
- **Orchestration**: Kubernetes (optional)
- **Monitoring**: Prometheus, Grafana

---

## 14. Conclusion

This System Design Document provides a comprehensive technical foundation for implementing the Real-Time Emotion and Engagement Detection System. The architecture is designed to be scalable, secure, and maintainable while meeting the performance requirements outlined in the PRD.

The modular design allows for incremental development and testing, reducing project risk and enabling early validation of key components. The use of modern technologies and best practices ensures the system will be robust and future-proof.

---

## Appendix

### A. Glossary
- **CNN**: Convolutional Neural Network
- **FER-2013**: Facial Expression Recognition dataset
- **WebRTC**: Web Real-Time Communication
- **JWT**: JSON Web Token
- **API**: Application Programming Interface

### B. References
- TensorFlow Documentation
- OpenCV Documentation
- WebRTC Specifications
- PostgreSQL Documentation
- React Documentation

### C. Version History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-19 | System Architect | Initial version |
