import os
import uuid
from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app, jsonify
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app import db
from app.models.document import Document
from app.models.progress import ReadingProgress
from app.utils.pdf_processor import extract_text_from_pdf, words_to_json, page_boundaries_to_json

dashboard_bp = Blueprint('dashboard', __name__)


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']


@dashboard_bp.route('/dashboard')
@login_required
def dashboard():
    """Display user's documents."""
    # Determine greeting
    from datetime import datetime, date, timedelta
    current_hour = datetime.now().hour
    if 5 <= current_hour < 12:
        greeting = "Good Morning"
    elif 12 <= current_hour < 17:
        greeting = "Good Afternoon"
    else:
        greeting = "Good Evening"
        
    user_name = current_user.name if current_user.name else current_user.email.split('@')[0]
    
    # Fetch reading activity for timeline with pagination
    from app.models.activity import ReadingActivity
    from itertools import groupby
    
    page = request.args.get('page', 1, type=int)
    per_page = 5
    
    pagination = ReadingActivity.query.filter_by(user_id=current_user.id)\
        .join(Document)\
        .order_by(ReadingActivity.date.desc(), ReadingActivity.created_at.desc())\
        .paginate(page=page, per_page=per_page, error_out=False)
        
    activities = pagination.items
        
    # Group by date
    timeline = []
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    for activity_date, group in groupby(activities, key=lambda x: x.date):
        if activity_date == today:
            date_label = "Today"
        elif activity_date == yesterday:
            date_label = "Yesterday"
        else:
            date_label = activity_date.strftime("%B %d, %Y")
            
        timeline.append({
            'date': date_label,
            'entries': list(group)
        })
    
    return render_template('dashboard.html', 
                         timeline=timeline, 
                         pagination=pagination,
                         greeting=greeting, 
                         user_name=user_name)


@dashboard_bp.route('/library')
@login_required
def library():
    """Display user's library of uploaded books."""
    documents = Document.query.filter_by(user_id=current_user.id).order_by(Document.created_at.desc()).all()
    
    # Get progress for each document
    docs_with_progress = []
    for doc in documents:
        progress = ReadingProgress.query.filter_by(
            user_id=current_user.id,
            document_id=doc.id
        ).first()
        
        docs_with_progress.append({
            'document': doc,
            'progress': progress.last_word_index if progress else 0,
            'percentage': round((progress.last_word_index / doc.word_count * 100) if progress and doc.word_count > 0 else 0, 1)
        })
    
    return render_template('library.html', documents=docs_with_progress)


@dashboard_bp.route('/upload', methods=['POST'])
@login_required
def upload():
    """Handle PDF upload."""
    if 'file' not in request.files:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'No file selected.'}), 400
        flash('No file selected.', 'error')
        return redirect(url_for('dashboard.dashboard'))
    
    file = request.files['file']
    
    if file.filename == '':
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'No file selected.'}), 400
        flash('No file selected.', 'error')
        return redirect(url_for('dashboard.dashboard'))
    
    if not allowed_file(file.filename):
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Only PDF files are allowed.'}), 400
        flash('Only PDF files are allowed.', 'error')
        return redirect(url_for('dashboard.dashboard'))
    
    try:
        # Create user directory
        user_upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], str(current_user.id))
        os.makedirs(user_upload_dir, exist_ok=True)
        
        # Generate unique filename
        original_name = secure_filename(file.filename)
        unique_name = f"{uuid.uuid4().hex}_{original_name}"
        file_path = os.path.join(user_upload_dir, unique_name)
        
        # Save file
        file.save(file_path)
        
        # Extract text from PDF (now also returns page boundaries)
        words, word_count, page_boundaries = extract_text_from_pdf(file_path)
        
        if word_count == 0:
            os.remove(file_path)
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'error': 'PDF appears to be empty or contains no readable text.'}), 400
            flash('PDF appears to be empty or contains no readable text.', 'warning')
            return redirect(url_for('dashboard.dashboard'))
        
        # Create document record with page boundaries
        document = Document(
            user_id=current_user.id,
            file_path=file_path,
            original_name=original_name,
            word_count=word_count,
            extracted_text=words_to_json(words),
            page_boundaries=page_boundaries_to_json(page_boundaries)
        )
        db.session.add(document)
        db.session.commit()
        
        message = f'Successfully uploaded "{original_name}" ({word_count} words, {len(page_boundaries)} pages).'
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': True, 'message': message})
            
        flash(message, 'success')
    
    except ValueError as e:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': str(e)}), 400
        flash(str(e), 'error')
    except Exception as e:
        current_app.logger.error(f"Upload error: {str(e)}")
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'An error occurred while processing the file.'}), 500
        flash('An error occurred while processing the file.', 'error')
    
    return redirect(url_for('dashboard.dashboard'))


@dashboard_bp.route('/document/<int:doc_id>', methods=['DELETE'])
@login_required
def delete_document(doc_id):
    """Delete a document."""
    document = Document.query.filter_by(id=doc_id, user_id=current_user.id).first()
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    try:
        # Delete file from disk
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
        
        # Delete from database
        db.session.delete(document)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Document deleted'})
    
    except Exception as e:
        current_app.logger.error(f"Delete error: {str(e)}")
        return jsonify({'error': 'Failed to delete document'}), 500
