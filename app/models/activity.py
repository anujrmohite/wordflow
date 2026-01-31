from datetime import datetime
from app import db

class ReadingActivity(db.Model):
    """Model for logging reading sessions history."""
    
    __tablename__ = 'reading_activity'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False)
    date = db.Column(db.Date, nullable=False, index=True)
    words_read = db.Column(db.Integer, default=0)
    minutes_read = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships (optional, but good for queries)
    document = db.relationship('Document', backref=db.backref('activities', cascade='all, delete-orphan'))
    
    def __repr__(self):
        return f'<ReadingActivity user={self.user_id} doc={self.document_id} date={self.date}>'
