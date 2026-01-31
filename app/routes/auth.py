from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required, current_user
from app import db
from app.models.user import User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/')
def index():
    """Redirect to dashboard if logged in, otherwise to login."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.dashboard'))
    return redirect(url_for('auth.login'))


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    """User registration."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        name = request.form.get('name', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        # Validation
        if not email or not password or not name:
            flash('All fields are required.', 'error')
            return render_template('auth/register.html')
        
        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            return render_template('auth/register.html')
        
        if len(password) < 6:
            flash('Password must be at least 6 characters.', 'error')
            return render_template('auth/register.html')
        
        # Check if email exists
        if User.query.filter_by(email=email).first():
            flash('Email already registered.', 'error')
            return render_template('auth/register.html')
        
        # Create user
        user = User(email=email, name=name)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('auth/register.html')


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """User login."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        remember = request.form.get('remember', False)
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            login_user(user, remember=bool(remember))
            next_page = request.args.get('next')
            flash('Login successful!', 'success')
            return redirect(next_page or url_for('dashboard.dashboard'))
        else:
            flash('Invalid email or password.', 'error')
    
    return render_template('auth/login.html')


@auth_bp.route('/profile')
@login_required
def profile():
    """User profile page."""
    return render_template('profile.html')


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """User logout."""
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))
