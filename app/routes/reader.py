from flask import Blueprint, render_template, jsonify, request, current_app
from flask_login import login_required, current_user
from app import db
from app.models.document import Document
from app.models.progress import ReadingProgress
from app.utils.pdf_processor import json_to_words, json_to_page_boundaries

reader_bp = Blueprint('reader', __name__)


@reader_bp.route('/read/<int:doc_id>')
@login_required
def read(doc_id):
    """Display the reader page for a document."""
    document = Document.query.filter_by(id=doc_id, user_id=current_user.id).first()
    
    if not document:
        return render_template('error.html', message='Document not found'), 404
    
    # Get or create progress
    progress = ReadingProgress.query.filter_by(
        user_id=current_user.id,
        document_id=doc_id
    ).first()
    
    if not progress:
        progress = ReadingProgress(
            user_id=current_user.id,
            document_id=doc_id,
            last_word_index=0,
            wpm=current_app.config['WPM_DEFAULT'],
            font_size=current_app.config['FONT_SIZE_DEFAULT']
        )
        db.session.add(progress)
        db.session.commit()
    
    return render_template('reader.html', 
                           document=document, 
                           progress=progress,
                           wpm_min=current_app.config['WPM_MIN'],
                           wpm_max=current_app.config['WPM_MAX'])


@reader_bp.route('/api/words/<int:doc_id>')
@login_required
def get_words(doc_id):
    """Get all words for a document with page boundaries."""
    document = Document.query.filter_by(id=doc_id, user_id=current_user.id).first()
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    words = json_to_words(document.extracted_text)
    page_boundaries = json_to_page_boundaries(document.page_boundaries)
    
    return jsonify({
        'words': words,
        'total': len(words),
        'document_name': document.original_name,
        'pages': page_boundaries  # Actual PDF page boundaries
    })


@reader_bp.route('/api/progress/<int:doc_id>', methods=['GET'])
@login_required
def get_progress(doc_id):
    """Get reading progress for a document."""
    progress = ReadingProgress.query.filter_by(
        user_id=current_user.id,
        document_id=doc_id
    ).first()
    
    if not progress:
        return jsonify({
            'last_word_index': 0,
            'wpm': current_app.config['WPM_DEFAULT'],
            'font_size': current_app.config['FONT_SIZE_DEFAULT']
        })
    
    return jsonify({
        'last_word_index': progress.last_word_index,
        'wpm': progress.wpm,
        'font_size': progress.font_size
    })


@reader_bp.route('/api/progress/<int:doc_id>', methods=['POST'])
@login_required
def save_progress(doc_id):
    """Save reading progress for a document."""
    document = Document.query.filter_by(id=doc_id, user_id=current_user.id).first()
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    data = request.get_json()
    
    progress = ReadingProgress.query.filter_by(
        user_id=current_user.id,
        document_id=doc_id
    ).first()
    
    if not progress:
        progress = ReadingProgress(
            user_id=current_user.id,
            document_id=doc_id
        )
        db.session.add(progress)
    
    # Log activity for history timeline
    from datetime import date
    from app.models.activity import ReadingActivity
    
    today = date.today()
    activity = ReadingActivity.query.filter_by(
        user_id=current_user.id,
        document_id=doc_id,
        date=today
    ).first()
    
    # Calculate words read delta
    previous_index = progress.last_word_index
    new_index = int(data.get('last_word_index', previous_index))
    words_delta = max(0, new_index - previous_index)
    
    # Update progress fields
    if 'last_word_index' in data:
        progress.last_word_index = int(data['last_word_index'])
    if 'wpm' in data:
        progress.wpm = max(current_app.config['WPM_MIN'], 
                          min(current_app.config['WPM_MAX'], int(data['wpm'])))
    if 'font_size' in data:
        progress.font_size = int(data['font_size'])
        
    # Update or create activity record
    if words_delta > 0:
        if activity:
            activity.words_read += words_delta
            # Simple assumption: 1 word at avg speed ~ time. 
            # Better to count words/wpm but for MVP words is key.
        else:
            activity = ReadingActivity(
                user_id=current_user.id,
                document_id=doc_id,
                date=today,
                words_read=words_delta
            )
            db.session.add(activity)
    
    db.session.commit()
    
    return jsonify({'success': True})
