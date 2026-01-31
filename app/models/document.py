from datetime import datetime
from app import db


class Document(db.Model):
    """Document model for storing uploaded PDFs."""
    
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    file_path = db.Column(db.String(512), nullable=False)
    original_name = db.Column(db.String(256), nullable=False)
    word_count = db.Column(db.Integer, default=0)
    extracted_text = db.Column(db.Text, nullable=True)  # Stored as JSON array of words
    page_boundaries = db.Column(db.Text, nullable=True)  # JSON array of {page, start, end}
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to reading progress
    progress = db.relationship('ReadingProgress', backref='document', uselist=False, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Document {self.original_name}>'
