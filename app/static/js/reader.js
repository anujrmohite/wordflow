/**
 * WordFlow Reader - Word-by-Word Display Controller
 */

class WordFlowReader {
    constructor(options) {
        this.docId = options.docId;
        this.initialWordIndex = options.initialWordIndex || 0;
        this.wpm = options.wpm || 200;
        this.fontSize = options.fontSize || 48;
        this.wpmMin = options.wpmMin || 60;
        this.wpmMax = options.wpmMax || 600;
        
        this.words = [];
        this.currentIndex = this.initialWordIndex;
        this.isPlaying = false;
        this.timer = null;
        this.autoSaveInterval = null;
        this.lastSavedIndex = this.initialWordIndex;
        
        this.init();
    }
    
    async init() {
        // Cache DOM elements
        this.elements = {
            wordDisplay: document.getElementById('wordDisplay'),
            playBtn: document.getElementById('playBtn'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            wpmSlider: document.getElementById('wpmSlider'),
            wpmValue: document.getElementById('wpmValue'),
            fontIncrease: document.getElementById('fontIncrease'),
            fontDecrease: document.getElementById('fontDecrease'),
            fontSizeValue: document.getElementById('fontSizeValue'),
            currentWord: document.getElementById('currentWord'),
            totalWords: document.getElementById('totalWords'),
            progressBar: document.getElementById('progressBar'),
            progressPercent: document.getElementById('progressPercent'),
            // Sidebar elements
            sidebar: document.getElementById('readerSidebar'),
            sidebarToggle: document.getElementById('sidebarToggle'),
            sidebarWordsRead: document.getElementById('sidebarWordsRead'),
            sidebarWordsLeft: document.getElementById('sidebarWordsLeft'),
            sidebarPercent: document.getElementById('sidebarPercent'),
            sidebarTimeLeft: document.getElementById('sidebarTimeLeft'),
            sidebarWPM: document.getElementById('sidebarWPM'),
            progressRing: document.getElementById('progressRing'),
            positionMarker: document.getElementById('positionMarker'),
            // Page preview elements
            pageSlidesContainer: document.getElementById('pageSlidesContainer'),
            currentPageNum: document.getElementById('currentPageNum'),
            totalPages: document.getElementById('totalPages'),
            prevPageBtn: document.getElementById('prevPageBtn'),
            nextPageBtn: document.getElementById('nextPageBtn')
        };
        
        // Page configuration
        this.wordsPerLine = 10;  // Approximate words per line
        this.linesPerPage = 15; // Lines per page
        this.wordsPerPage = this.wordsPerLine * this.linesPerPage;
        this.currentPage = 0;
        this.totalPageCount = 1;
        
        // Set initial font size
        this.setFontSize(this.fontSize);
        
        // Bind event listeners
        this.bindEvents();
        
        // Load words from API
        await this.loadWords();
        
        // Generate page slides after words are loaded
        this.generatePageSlides();
        
        // Start auto-save
        this.startAutoSave();
        
        // Handle page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isPlaying) {
                this.pause();
            }
        });
        
        // Save on page unload
        window.addEventListener('beforeunload', () => {
            this.saveProgress();
        });
    }
    
    bindEvents() {
        // Play/Pause
        this.elements.playBtn.addEventListener('click', () => this.togglePlay());
        
        // Navigation
        this.elements.prevBtn.addEventListener('click', () => this.prev());
        this.elements.nextBtn.addEventListener('click', () => this.next());
        
        // Speed control
        this.elements.wpmSlider.addEventListener('input', (e) => {
            this.setWPM(parseInt(e.target.value));
        });
        
        // Font size controls
        this.elements.fontIncrease.addEventListener('click', () => {
            this.setFontSize(this.fontSize + 4);
        });
        
        this.elements.fontDecrease.addEventListener('click', () => {
            this.setFontSize(this.fontSize - 4);
        });
        
        // Sidebar toggle (left)
        if (this.elements.sidebarToggle) {
            this.elements.sidebarToggle.addEventListener('click', () => {
                this.elements.sidebar.classList.toggle('collapsed');
                // Update icon based on state
                const isCollapsed = this.elements.sidebar.classList.contains('collapsed');
                this.elements.sidebarToggle.innerHTML = isCollapsed
                    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>'
                    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            });
        }
        
        // Right sidebar toggle
        const sidebarRight = document.getElementById('readerSidebarRight');
        const sidebarToggleRight = document.getElementById('sidebarToggleRight');
        if (sidebarToggleRight && sidebarRight) {
            sidebarToggleRight.addEventListener('click', () => {
                sidebarRight.classList.toggle('collapsed');
                // Update icon based on state
                const isCollapsed = sidebarRight.classList.contains('collapsed');
                sidebarToggleRight.innerHTML = isCollapsed
                    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>'
                    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            });
        }
        
        // Page navigation buttons
        if (this.elements.prevPageBtn) {
            this.elements.prevPageBtn.addEventListener('click', () => this.goToPrevPage());
        }
        if (this.elements.nextPageBtn) {
            this.elements.nextPageBtn.addEventListener('click', () => this.goToNextPage());
        }
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowLeft':
                    this.prev();
                    break;
                case 'ArrowRight':
                    this.next();
                    break;
                case 'ArrowUp':
                    this.setWPM(this.wpm + 10);
                    break;
                case 'ArrowDown':
                    this.setWPM(this.wpm - 10);
                    break;
            }
        });
    }
    
    async loadWords() {
        try {
            const response = await fetch(`/api/words/${this.docId}`);
            if (!response.ok) throw new Error('Failed to load words');
            
            const data = await response.json();
            this.words = data.words;
            
            // Store actual PDF page boundaries
            this.pdfPages = data.pages || [];
            this.totalPageCount = this.pdfPages.length;
            
            // Update total words display
            this.elements.totalWords.textContent = this.words.length;
            
            // Display first word or resume position
            this.displayWord();
        } catch (error) {
            console.error('Error loading words:', error);
            this.elements.wordDisplay.textContent = 'Error loading document';
        }
    }
    
    displayWord() {
        if (this.words.length === 0) return;
        
        // Ensure index is within bounds
        this.currentIndex = Math.max(0, Math.min(this.currentIndex, this.words.length - 1));
        
        // Display current word
        this.elements.wordDisplay.textContent = this.words[this.currentIndex];
        
        // Update progress indicators
        this.updateProgress();
    }
    
    updateProgress() {
        const current = this.currentIndex + 1;
        const total = this.words.length;
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        const wordsLeft = total - current;
        
        // Update main progress
        this.elements.currentWord.textContent = current;
        this.elements.progressBar.style.width = `${percent}%`;
        this.elements.progressPercent.textContent = `${percent}%`;
        
        // Update sidebar stats
        if (this.elements.sidebarWordsRead) {
            this.elements.sidebarWordsRead.textContent = current;
        }
        if (this.elements.sidebarWordsLeft) {
            this.elements.sidebarWordsLeft.textContent = wordsLeft;
        }
        if (this.elements.sidebarPercent) {
            this.elements.sidebarPercent.textContent = percent;
        }
        
        // Update progress circle (stroke-dashoffset: 283 = full circle, 0 = complete)
        if (this.elements.progressRing) {
            const circumference = 283;
            const offset = circumference - (percent / 100) * circumference;
            this.elements.progressRing.style.strokeDashoffset = offset;
            this.elements.progressRing.style.stroke = 'var(--accent-primary)';
        }
        
        // Update position marker
        if (this.elements.positionMarker) {
            this.elements.positionMarker.style.left = `${percent}%`;
        }
        
        // Update time remaining
        this.updateTimeRemaining(wordsLeft);
        
        // Update page preview
        this.updatePagePreview();
    }
    
    updateTimeRemaining(wordsLeft) {
        if (!this.elements.sidebarTimeLeft) return;
        
        const minutesLeft = wordsLeft / this.wpm;
        const mins = Math.floor(minutesLeft);
        const secs = Math.round((minutesLeft - mins) * 60);
        
        if (wordsLeft === 0) {
            this.elements.sidebarTimeLeft.textContent = 'Done!';
        } else if (mins > 60) {
            const hours = Math.floor(mins / 60);
            const remainingMins = mins % 60;
            this.elements.sidebarTimeLeft.textContent = `${hours}h ${remainingMins}m`;
        } else {
            this.elements.sidebarTimeLeft.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    generatePageSlides() {
        if (!this.elements.pageSlidesContainer) return;
        
        // Use actual PDF pages if available, otherwise fall back to artificial pages
        if (!this.pdfPages || this.pdfPages.length === 0) {
            // Fallback: create artificial pages
            const total = this.words.length;
            this.totalPageCount = Math.ceil(total / this.wordsPerPage);
            this.pdfPages = [];
            for (let i = 0; i < this.totalPageCount; i++) {
                this.pdfPages.push({
                    page: i + 1,
                    start: i * this.wordsPerPage,
                    end: Math.min((i + 1) * this.wordsPerPage - 1, total - 1)
                });
            }
        }
        
        this.totalPageCount = this.pdfPages.length;
        
        // Update total pages display
        if (this.elements.totalPages) {
            this.elements.totalPages.textContent = this.totalPageCount;
        }
        
        // Clear container
        this.elements.pageSlidesContainer.innerHTML = '';
        
        // Generate page slides for each REAL PDF page
        this.pdfPages.forEach((pageData, index) => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page-slide';
            pageDiv.dataset.page = index;
            pageDiv.dataset.start = pageData.start;
            pageDiv.dataset.end = pageData.end;
            
            // Page header (real PDF page number)
            const header = document.createElement('div');
            header.className = 'page-slide-header';
            header.textContent = `Page ${pageData.page}`;
            pageDiv.appendChild(header);
            
            // Page content container - show actual text from this PDF page
            const contentDiv = document.createElement('div');
            contentDiv.className = 'page-content';
            
            // Get words for this actual PDF page
            const pageWords = this.words.slice(pageData.start, pageData.end + 1);
            
            // Create lines for display - show ALL lines (page content scrolls)
            const wordsPerLine = 10;
            const totalLines = Math.ceil(pageWords.length / wordsPerLine);
            
            for (let line = 0; line < totalLines; line++) {
                const lineStart = pageData.start + (line * wordsPerLine);
                const lineEnd = Math.min(lineStart + wordsPerLine - 1, pageData.end);
                const lineWords = this.words.slice(lineStart, lineEnd + 1);
                
                const lineDiv = document.createElement('div');
                lineDiv.className = 'page-text-line';
                lineDiv.dataset.lineStart = lineStart;
                lineDiv.dataset.lineEnd = lineEnd;
                lineDiv.textContent = lineWords.join(' ');
                
                contentDiv.appendChild(lineDiv);
            }
            
            pageDiv.appendChild(contentDiv);
            
            // Click to jump to this PDF page
            pageDiv.addEventListener('click', () => {
                this.jumpToPage(index);
            });
            
            this.elements.pageSlidesContainer.appendChild(pageDiv);
        });
        
        // Set initial page based on current position
        this.currentPage = this.findCurrentPage();
        this.updatePagePreview();
    }
    
    findCurrentPage() {
        // Find which PDF page contains the current word index
        for (let i = 0; i < this.pdfPages.length; i++) {
            const page = this.pdfPages[i];
            if (this.currentIndex >= page.start && this.currentIndex <= page.end) {
                return i;
            }
        }
        return 0;
    }
    
    updatePagePreview() {
        if (!this.elements.pageSlidesContainer || !this.pdfPages.length) return;
        
        // Find current page based on word index
        const newPage = this.findCurrentPage();
        
        // Update page indicator
        if (this.elements.currentPageNum) {
            this.elements.currentPageNum.textContent = newPage + 1;
        }
        
        // Update page navigation buttons
        if (this.elements.prevPageBtn) {
            this.elements.prevPageBtn.disabled = newPage === 0;
        }
        if (this.elements.nextPageBtn) {
            this.elements.nextPageBtn.disabled = newPage >= this.totalPageCount - 1;
        }
        
        // Update page slides
        const pageSlides = this.elements.pageSlidesContainer.querySelectorAll('.page-slide');
        pageSlides.forEach((slide, index) => {
            slide.classList.toggle('active', index === newPage);
        });
        
        // Update line markers (text lines with yellow highlight)
        const allLines = this.elements.pageSlidesContainer.querySelectorAll('.page-text-line');
        let currentLineElement = null;
        
        allLines.forEach(line => {
            const lineStart = parseInt(line.dataset.lineStart);
            const lineEnd = parseInt(line.dataset.lineEnd);
            
            // Current line (yellow highlight)
            const isCurrent = this.currentIndex >= lineStart && this.currentIndex <= lineEnd;
            line.classList.toggle('current-line', isCurrent);
            
            if (isCurrent) {
                currentLineElement = line;
            }
            
            // Read lines (dimmed)
            const isRead = lineEnd < this.currentIndex;
            line.classList.toggle('read', isRead);
        });
        
        // Scroll current line into view within page content
        if (currentLineElement) {
            const pageContent = currentLineElement.closest('.page-content');
            if (pageContent) {
                const lineTop = currentLineElement.offsetTop - pageContent.offsetTop;
                const lineHeight = currentLineElement.offsetHeight;
                const containerHeight = pageContent.clientHeight;
                const scrollTop = pageContent.scrollTop;
                
                // Scroll if line is not visible
                if (lineTop < scrollTop || lineTop + lineHeight > scrollTop + containerHeight) {
                    pageContent.scrollTo({
                        top: lineTop - containerHeight / 3,
                        behavior: 'smooth'
                    });
                }
            }
        }
        
        // Scroll to active page if changed
        if (newPage !== this.currentPage) {
            this.currentPage = newPage;
            const activeSlide = this.elements.pageSlidesContainer.querySelector('.page-slide.active');
            if (activeSlide) {
                activeSlide.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
    
    jumpToPage(pageIndex) {
        if (!this.pdfPages || pageIndex < 0 || pageIndex >= this.pdfPages.length) return;
        
        // Jump to the start of the actual PDF page
        const page = this.pdfPages[pageIndex];
        this.currentIndex = page.start;
        this.currentPage = pageIndex;
        this.displayWord();
        
        // If playing, restart timer
        if (this.isPlaying) {
            this.startTimer();
        }
    }
    
    goToPrevPage() {
        if (this.currentPage > 0) {
            this.jumpToPage(this.currentPage - 1);
        }
    }
    
    goToNextPage() {
        if (this.currentPage < this.totalPageCount - 1) {
            this.jumpToPage(this.currentPage + 1);
        }
    }
    
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        if (this.currentIndex >= this.words.length - 1) {
            // Reset to beginning if at end
            this.currentIndex = 0;
            this.displayWord();
        }
        
        this.isPlaying = true;
        this.elements.playBtn.classList.add('playing');
        this.elements.playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
        
        this.startTimer();
    }
    
    pause() {
        this.isPlaying = false;
        this.elements.playBtn.classList.remove('playing');
        this.elements.playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line></svg>';
        
        this.stopTimer();
        this.saveProgress();
    }
    
    startTimer() {
        this.stopTimer();
        
        const interval = (60 / this.wpm) * 1000; // Convert WPM to milliseconds
        
        this.timer = setInterval(() => {
            if (this.currentIndex < this.words.length - 1) {
                this.currentIndex++;
                this.displayWord();
            } else {
                this.pause();
            }
        }, interval);
    }
    
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    
    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.displayWord();
            
            // If playing, restart timer to reset timing
            if (this.isPlaying) {
                this.startTimer();
            }
        }
    }
    
    next() {
        if (this.currentIndex < this.words.length - 1) {
            this.currentIndex++;
            this.displayWord();
            
            // If playing, restart timer to reset timing
            if (this.isPlaying) {
                this.startTimer();
            }
        }
    }
    
    setWPM(value) {
        // Clamp value to valid range
        this.wpm = Math.max(this.wpmMin, Math.min(this.wpmMax, value));
        
        // Update UI
        this.elements.wpmSlider.value = this.wpm;
        this.elements.wpmValue.textContent = this.wpm;
        
        // Update sidebar WPM
        if (this.elements.sidebarWPM) {
            this.elements.sidebarWPM.textContent = this.wpm;
        }
        
        // Recalculate time remaining
        const wordsLeft = this.words.length - this.currentIndex - 1;
        this.updateTimeRemaining(wordsLeft);
        
        // Restart timer if playing
        if (this.isPlaying) {
            this.startTimer();
        }
    }
    
    setFontSize(size) {
        // Clamp font size
        this.fontSize = Math.max(24, Math.min(120, size));
        
        // Update UI
        this.elements.wordDisplay.style.fontSize = `${this.fontSize}px`;
        this.elements.fontSizeValue.textContent = this.fontSize;
    }
    
    startAutoSave() {
        // Save progress every 5 seconds
        this.autoSaveInterval = setInterval(() => {
            if (this.currentIndex !== this.lastSavedIndex) {
                this.saveProgress();
            }
        }, 5000);
    }
    
    async saveProgress() {
        try {
            await fetch(`/api/progress/${this.docId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    last_word_index: this.currentIndex,
                    wpm: this.wpm,
                    font_size: this.fontSize
                })
            });
            
            this.lastSavedIndex = this.currentIndex;
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }
    
    destroy() {
        this.stopTimer();
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        this.saveProgress();
    }
}

// Initialize reader when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (typeof DOC_ID !== 'undefined') {
        window.reader = new WordFlowReader({
            docId: DOC_ID,
            initialWordIndex: INITIAL_WORD_INDEX,
            wpm: INITIAL_WPM,
            fontSize: INITIAL_FONT_SIZE,
            wpmMin: WPM_MIN,
            wpmMax: WPM_MAX
        });
    }
});
