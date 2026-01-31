import pdfplumber
import re
import json


def is_cjk(char):
    """Check if a character is a CJK character."""
    code = ord(char)
    return (
        0x4E00 <= code <= 0x9FFF or  # CJK Unified Ideographs
        0x3400 <= code <= 0x4DBF or  # CJK Unified Ideographs Extension A
        0x3040 <= code <= 0x309F or  # Hiragana
        0x30A0 <= code <= 0x30FF or  # Katakana
        0xAC00 <= code <= 0xD7AF      # Hangul Syllables
    )

def tokenize_text(text):
    """
    Tokenize text into words, handling CJK characters as individual tokens.
    """
    if not text:
        return []
        
    words = []
    current_token = ""
    
    for char in text:
        if is_cjk(char):
            # If we have a pending token, add it first
            if current_token:
                words.append(current_token)
                current_token = ""
            # Add the CJK character as a separate token
            words.append(char)
        elif char.isspace():
            # End of token
            if current_token:
                words.append(current_token)
                current_token = ""
        else:
            # Append to current token
            current_token += char
            
    if current_token:
        words.append(current_token)
        
    return words

def extract_text_from_pdf(file_path):
    """
    Extract text from a PDF file and split into words.
    Also tracks page boundaries for preview.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        tuple: (list of words, word count, list of page boundaries)
        page boundaries is a list of dicts with 'start' and 'end' word indices
    """
    words = []
    page_boundaries = []
    current_index = 0
    
    try:
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text()
                page_start = current_index
                
                if text:
                    # Tokenize text with CJK support
                    page_words = tokenize_text(text)
                    words.extend(page_words)
                    current_index += len(page_words)
                
                page_boundaries.append({
                    'page': page_num + 1,
                    'start': page_start,
                    'end': current_index - 1 if current_index > page_start else page_start
                })
    except Exception as e:
        raise ValueError(f"Error extracting text from PDF: {str(e)}")
    
    return words, len(words), page_boundaries


def words_to_json(words):
    """Convert word list to JSON string for storage."""
    return json.dumps(words)


def json_to_words(json_str):
    """Convert JSON string back to word list."""
    if not json_str:
        return []
    return json.loads(json_str)


def page_boundaries_to_json(page_boundaries):
    """Convert page boundaries list to JSON string for storage."""
    return json.dumps(page_boundaries)


def json_to_page_boundaries(json_str):
    """Convert JSON string back to page boundaries list."""
    if not json_str:
        return []
    return json.loads(json_str)
