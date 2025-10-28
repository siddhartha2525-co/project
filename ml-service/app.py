from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import tensorflow as tf
from PIL import Image
import io
import base64
import psycopg2
import redis
import json
import os
from datetime import datetime
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global variables
emotion_model = None
face_cascade = None
emotion_labels = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']

def load_emotion_model():
    """Load the pre-trained emotion detection model"""
    global emotion_model
    try:
        model_path = os.getenv('MODEL_PATH', './models/emotion_model.h5')
        if os.path.exists(model_path):
            emotion_model = tf.keras.models.load_model(model_path)
            logger.info(f"Emotion model loaded from {model_path}")
        else:
            logger.warning(f"Model file not found at {model_path}, using placeholder model")
            # Create a simple placeholder model for demonstration
            emotion_model = create_placeholder_model()
    except Exception as e:
        logger.error(f"Error loading emotion model: {e}")
        emotion_model = create_placeholder_model()

def create_placeholder_model():
    """Create a simple placeholder model for demonstration purposes"""
    model = tf.keras.Sequential([
        tf.keras.layers.Conv2D(32, (3, 3), activation='relu', input_shape=(48, 48, 1)),
        tf.keras.layers.MaxPooling2D((2, 2)),
        tf.keras.layers.Conv2D(64, (3, 3), activation='relu'),
        tf.keras.layers.MaxPooling2D((2, 2)),
        tf.keras.layers.Conv2D(64, (3, 3), activation='relu'),
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(64, activation='relu'),
        tf.keras.layers.Dense(7, activation='softmax')
    ])
    model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    return model

def load_face_cascade():
    """Load OpenCV face detection cascade"""
    global face_cascade
    try:
        # Try to load from OpenCV data directory
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        if face_cascade.empty():
            raise Exception("Failed to load face cascade")
        logger.info("Face detection cascade loaded successfully")
    except Exception as e:
        logger.error(f"Error loading face cascade: {e}")
        face_cascade = None

def preprocess_image(image_data):
    """Preprocess image for emotion detection"""
    try:
        # Convert base64 to image
        if isinstance(image_data, str):
            # Remove data URL prefix if present
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
        else:
            image = Image.open(image_data)
        
        # Convert to grayscale
        if image.mode != 'L':
            image = image.convert('L')
        
        # Resize to 48x48 (standard for emotion detection)
        image = image.resize((48, 48))
        
        # Convert to numpy array and normalize
        image_array = np.array(image)
        image_array = image_array.astype('float32') / 255.0
        
        # Add batch and channel dimensions
        image_array = np.expand_dims(image_array, axis=[0, -1])
        
        return image_array
    except Exception as e:
        logger.error(f"Error preprocessing image: {e}")
        return None

def detect_emotion(image_array):
    """Detect emotion from preprocessed image"""
    try:
        if emotion_model is None:
            # Return random emotion for demonstration
            import random
            emotion_idx = random.randint(0, len(emotion_labels) - 1)
            confidence = random.uniform(0.6, 0.95)
            return emotion_labels[emotion_idx], confidence
        
        # Predict emotion
        predictions = emotion_model.predict(image_array, verbose=0)
        emotion_idx = np.argmax(predictions[0])
        confidence = float(predictions[0][emotion_idx])
        
        return emotion_labels[emotion_idx], confidence
    except Exception as e:
        logger.error(f"Error detecting emotion: {e}")
        return 'neutral', 0.5

def calculate_engagement_score(emotion, confidence):
    """Calculate engagement score based on emotion and confidence"""
    # Define emotion weights (higher = more engaged)
    emotion_weights = {
        'happy': 0.9,
        'surprise': 0.8,
        'neutral': 0.7,
        'fear': 0.4,
        'sad': 0.3,
        'angry': 0.2,
        'disgust': 0.1
    }
    
    # Base score from emotion
    base_score = emotion_weights.get(emotion, 0.5)
    
    # Adjust based on confidence
    adjusted_score = base_score * confidence + (1 - confidence) * 0.5
    
    # Normalize to 0-1 range
    return max(0.0, min(1.0, adjusted_score))

def get_database_connection():
    """Get PostgreSQL database connection"""
    try:
        return psycopg2.connect(os.getenv('DATABASE_URL'))
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return None

def get_redis_connection():
    """Get Redis connection"""
    try:
        return redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
    except Exception as e:
        logger.error(f"Redis connection error: {e}")
        return None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ML Emotion Detection Service',
        'timestamp': datetime.now().isoformat(),
        'model_loaded': emotion_model is not None,
        'face_cascade_loaded': face_cascade is not None
    })

@app.route('/detect_emotion', methods=['POST'])
def detect_emotion_endpoint():
    """Main endpoint for emotion detection"""
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'Image data required'}), 400
        
        # Extract data
        image_data = data['image']
        session_id = data.get('session_id')
        student_id = data.get('student_id')
        
        # Preprocess image
        processed_image = preprocess_image(image_data)
        if processed_image is None:
            return jsonify({'error': 'Failed to process image'}), 400
        
        # Detect emotion
        emotion, confidence = detect_emotion(processed_image)
        
        # Calculate engagement score
        engagement_score = calculate_engagement_score(emotion, confidence)
        
        # Store in database if session and student info provided
        if session_id and student_id:
            store_engagement_data(session_id, student_id, emotion, confidence, engagement_score)
        
        # Cache recent results in Redis
        cache_engagement_data(session_id, student_id, emotion, confidence, engagement_score)
        
        return jsonify({
            'emotion': emotion,
            'confidence': confidence,
            'engagement_score': engagement_score,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in emotion detection endpoint: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/detect_emotion_batch', methods=['POST'])
def detect_emotion_batch():
    """Batch emotion detection for multiple images"""
    try:
        data = request.get_json()
        
        if not data or 'images' not in data:
            return jsonify({'error': 'Images array required'}), 400
        
        images = data['images']
        session_id = data.get('session_id')
        student_id = data.get('student_id')
        
        results = []
        
        for i, image_data in enumerate(images):
            try:
                # Preprocess image
                processed_image = preprocess_image(image_data)
                if processed_image is None:
                    results.append({
                        'index': i,
                        'error': 'Failed to process image'
                    })
                    continue
                
                # Detect emotion
                emotion, confidence = detect_emotion(processed_image)
                engagement_score = calculate_engagement_score(emotion, confidence)
                
                results.append({
                    'index': i,
                    'emotion': emotion,
                    'confidence': confidence,
                    'engagement_score': engagement_score
                })
                
            except Exception as e:
                logger.error(f"Error processing image {i}: {e}")
                results.append({
                    'index': i,
                    'error': str(e)
                })
        
        return jsonify({
            'results': results,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in batch emotion detection: {e}")
        return jsonify({'error': 'Internal server error'}), 500

def store_engagement_data(session_id, student_id, emotion, confidence, engagement_score):
    """Store engagement data in PostgreSQL"""
    try:
        conn = get_database_connection()
        if conn is None:
            return
        
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO engagement_metrics (session_id, student_id, timestamp, emotion, confidence, engagement_score)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (session_id, student_id, datetime.now(), emotion, confidence, engagement_score))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.debug(f"Stored engagement data: session={session_id}, student={student_id}, emotion={emotion}")
        
    except Exception as e:
        logger.error(f"Error storing engagement data: {e}")

def cache_engagement_data(session_id, student_id, emotion, confidence, engagement_score):
    """Cache engagement data in Redis for real-time access"""
    try:
        redis_conn = get_redis_connection()
        if redis_conn is None:
            return
        
        # Cache key format: engagement:session:{session_id}:student:{student_id}
        cache_key = f"engagement:session:{session_id}:student:{student_id}"
        
        data = {
            'emotion': emotion,
            'confidence': confidence,
            'engagement_score': engagement_score,
            'timestamp': datetime.now().isoformat()
        }
        
        # Cache for 5 minutes
        redis_conn.setex(cache_key, 300, json.dumps(data))
        
        # Also cache in session summary
        session_key = f"session:{session_id}:summary"
        session_data = redis_conn.get(session_key)
        
        if session_data:
            summary = json.loads(session_data)
        else:
            summary = {
                'total_students': 0,
                'emotions': {},
                'average_engagement': 0.0,
                'last_updated': datetime.now().isoformat()
            }
        
        # Update summary
        summary['emotions'][emotion] = summary['emotions'].get(emotion, 0) + 1
        summary['last_updated'] = datetime.now().isoformat()
        
        # Cache session summary for 10 minutes
        redis_conn.setex(session_key, 600, json.dumps(summary))
        
    except Exception as e:
        logger.error(f"Error caching engagement data: {e}")

@app.route('/session_summary/<int:session_id>', methods=['GET'])
def get_session_summary(session_id):
    """Get real-time session summary from cache"""
    try:
        redis_conn = get_redis_connection()
        if redis_conn is None:
            return jsonify({'error': 'Cache service unavailable'}), 503
        
        cache_key = f"session:{session_id}:summary"
        session_data = redis_conn.get(cache_key)
        
        if session_data:
            summary = json.loads(session_data)
            return jsonify(summary)
        else:
            return jsonify({
                'total_students': 0,
                'emotions': {},
                'average_engagement': 0.0,
                'last_updated': datetime.now().isoformat()
            })
        
    except Exception as e:
        logger.error(f"Error getting session summary: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/student_engagement/<int:session_id>/<int:student_id>', methods=['GET'])
def get_student_engagement(session_id, student_id):
    """Get recent engagement data for a specific student"""
    try:
        redis_conn = get_redis_connection()
        if redis_conn is None:
            return jsonify({'error': 'Cache service unavailable'}), 503
        
        cache_key = f"engagement:session:{session_id}:student:{student_id}"
        engagement_data = redis_conn.get(cache_key)
        
        if engagement_data:
            return jsonify(json.loads(engagement_data))
        else:
            return jsonify({'error': 'No recent engagement data found'}), 404
        
    except Exception as e:
        logger.error(f"Error getting student engagement: {e}")
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Load models on startup
    load_emotion_model()
    load_face_cascade()
    
    # Get port from environment
    port = int(os.getenv('PORT', 5001))
    
    # Start Flask app
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')
