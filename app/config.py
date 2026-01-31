import os

class Config:
    """Application configuration."""
    
    # Secret key for session management
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'wordflow-secret-key-change-in-production'
    
    # Database
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        f'sqlite:///{os.path.join(BASE_DIR, "wordflow.db")}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # File uploads
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'pdf'}
    
    # Reader settings
    WPM_MIN = 60
    WPM_MAX = 600
    WPM_DEFAULT = 200
    FONT_SIZE_DEFAULT = 48
