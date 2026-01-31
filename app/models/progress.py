from datetime import datetime
from app import db


class ReadingProgress(db.Model):
    """Model for tracking user reading progress."""
    
    __tablename__ = 'reading_progress'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False, index=True)
    last_word_index = db.Column(db.Integer, default=0)
    wpm = db.Column(db.Integer, default=200)
    font_size = db.Column(db.Integer, default=48)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint for user-document pair
    __table_args__ = (
        db.UniqueConstraint('user_id', 'document_id', name='unique_user_document'),
    )
    
    def __repr__(self):
        return f'<ReadingProgress user={self.user_id} doc={self.document_id} word={self.last_word_index}>'
