#!/usr/bin/env python3
import sys
import json
import spacy
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from flashtext import KeywordProcessor
import re

# Load English tokenizer, POS tagger, etc.
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # Fallback to basic processing if spaCy model not available
    nlp = None

# Initialize FlashText keyword processors for high-speed extraction
skill_processor = KeywordProcessor(case_sensitive=False)
interest_processor = KeywordProcessor(case_sensitive=False)

# RIASEC mapping vectors for interest-career alignment
riasec_mappings = {
    "technology": {"realistic": 20, "investigative": 85, "artistic": 45, "social": 25, "enterprising": 30, "conventional": 40},
    "software": {"realistic": 15, "investigative": 90, "artistic": 50, "social": 20, "enterprising": 25, "conventional": 35},
    "research": {"realistic": 10, "investigative": 95, "artistic": 30, "social": 15, "enterprising": 20, "conventional": 25},
    "design": {"realistic": 30, "investigative": 40, "artistic": 90, "social": 35, "enterprising": 45, "conventional": 20},
    "healthcare": {"realistic": 40, "investigative": 70, "artistic": 25, "social": 85, "enterprising": 30, "conventional": 45},
    "business": {"realistic": 20, "investigative": 50, "artistic": 40, "social": 60, "enterprising": 90, "conventional": 70},
    "education": {"realistic": 25, "investigative": 55, "artistic": 60, "social": 90, "enterprising": 40, "conventional": 50},
    "engineering": {"realistic": 80, "investigative": 85, "artistic": 35, "social": 30, "enterprising": 45, "conventional": 60},
    "finance": {"realistic": 15, "investigative": 70, "artistic": 20, "social": 35, "enterprising": 80, "conventional": 90},
    "legal": {"realistic": 20, "investigative": 75, "artistic": 40, "social": 60, "enterprising": 70, "conventional": 80}
}

# Comprehensive keyword banks for career matching
career_keywords = {
    "Artificial Intelligence & Machine Learning": [
        "machine learning", "neural networks", "deep learning", "AI", "artificial intelligence",
        "tensorflow", "pytorch", "scikit-learn", "data science", "computer vision", "NLP",
        "natural language processing", "reinforcement learning", "supervised learning"
    ],
    "Cybersecurity": [
        "penetration testing", "firewall", "threat", "security", "cybersecurity", "CISSP",
        "ethical hacking", "vulnerability", "encryption", "malware", "incident response",
        "security operations", "SIEM", "risk assessment", "compliance"
    ],
    "Cloud Computing": [
        "AWS", "Azure", "cloud", "virtual machine", "Google Cloud", "Docker", "Kubernetes",
        "serverless", "microservices", "DevOps", "CI/CD", "infrastructure", "scalability"
    ],
    "Software Engineering": [
        "programming", "software", "code", "develop", "debug", "framework", "API",
        "full stack", "backend", "frontend", "mobile", "web development", "agile",
        "version control", "git", "testing", "software architecture"
    ],
    "Data Analytics & Science": [
        "data", "statistics", "SQL", "tableau", "Excel", "visualization", "analysis",
        "big data", "analytics", "business intelligence", "R", "Python", "pandas",
        "matplotlib", "statistical modeling", "predictive analytics"
    ],
    "Healthcare & Medicine": [
        "healthcare", "medical", "patient care", "clinical", "nursing", "physician",
        "pharmacy", "medical research", "biomedical", "health informatics", "EMR",
        "patient safety", "medical devices", "telemedicine"
    ],
    "Business & Finance": [
        "business", "finance", "accounting", "economics", "marketing", "sales",
        "management", "consulting", "investment", "banking", "financial analysis",
        "project management", "strategy", "operations", "MBA"
    ],
    "Education & Teaching": [
        "education", "teaching", "curriculum", "pedagogy", "classroom", "student",
        "learning", "instruction", "educational technology", "assessment", "academic",
        "training", "mentoring", "educational research"
    ],
    "Engineering": [
        "engineering", "mechanical", "electrical", "chemical", "civil", "aerospace",
        "biomedical engineering", "systems engineering", "design", "manufacturing",
        "CAD", "project engineering", "quality assurance"
    ],
    "Creative Arts & Design": [
        "design", "creative", "art", "graphic design", "UX", "UI", "visual",
        "multimedia", "photography", "video", "animation", "branding", "creative writing",
        "digital media", "illustration"
    ]
}

# Technical and soft skills database
skill_keywords = [
    # Programming Languages
    "Python", "JavaScript", "Java", "C++", "C#", "R", "SQL", "HTML", "CSS", "React",
    "Angular", "Vue", "Node.js", "PHP", "Ruby", "Go", "Rust", "Swift", "Kotlin",
    
    # Technical Skills
    "Linux", "Docker", "Kubernetes", "Git", "AWS", "Azure", "Google Cloud", "MongoDB",
    "PostgreSQL", "MySQL", "Redis", "Elasticsearch", "Tableau", "Power BI", "Excel",
    "MATLAB", "Hadoop", "Spark", "TensorFlow", "PyTorch", "Pandas", "NumPy",
    
    # Soft Skills
    "leadership", "teamwork", "communication", "problem-solving", "critical thinking",
    "project management", "collaboration", "adaptability", "time management",
    "analytical thinking", "creativity", "negotiation", "presentation", "mentoring"
]

def preprocess_text(text):
    """Clean and preprocess text for analysis"""
    if not text:
        return ""
    
    # Convert to lowercase and clean
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)  # Remove punctuation
    text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
    
    if nlp:
        # Use spaCy for advanced processing
        doc = nlp(text)
        tokens = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct and len(token.text) > 2]
        return " ".join(tokens)
    else:
        # Fallback to basic processing
        stop_words = {
            'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
            'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
            'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
            'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
            'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
            'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
            'while', 'of', 'at', 'by', 'for', 'with', 'through', 'during', 'before', 'after',
            'above', 'below', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
            'further', 'then', 'once'
        }
        tokens = [word for word in text.split() if word not in stop_words and len(word) > 2]
        return " ".join(tokens)

def calculate_career_matches(text_processed):
    """Calculate career field matches using keyword frequency and TF-IDF"""
    career_matches = {}
    
    for career, keywords in career_keywords.items():
        # Count direct keyword matches
        keyword_score = 0
        for keyword in keywords:
            keyword_count = text_processed.count(keyword.lower())
            keyword_score += keyword_count
        
        # Calculate TF-IDF similarity if we have matches
        if keyword_score > 0:
            # Create corpus with user text and career keywords
            corpus = [text_processed, " ".join(keywords)]
            try:
                vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
                tfidf_matrix = vectorizer.fit_transform(corpus)
                similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
                
                # Combine keyword frequency and TF-IDF similarity
                final_score = (keyword_score * 0.6) + (similarity * 0.4)
                career_matches[career] = final_score
            except:
                # Fallback to keyword score only
                career_matches[career] = keyword_score
    
    return career_matches

def extract_skills(text_processed):
    """Extract technical and soft skills using FlashText for high-speed keyword matching"""
    # Initialize FlashText processor with all skills
    if not skill_processor.keyword_trie_dict:
        for skill in skill_keywords:
            skill_processor.add_keyword(skill.lower())
            # Add variations
            skill_processor.add_keyword(skill.replace(" ", "").lower(), skill)
            skill_processor.add_keyword(skill.replace(" ", "-").lower(), skill)
    
    # Extract skills using FlashText (much faster than string matching)
    found_skills = skill_processor.extract_keywords(text_processed.lower())
    
    # Calculate skill relevance using frequency scoring
    if found_skills:
        skill_scores = {}
        for skill in found_skills:
            skill_scores[skill] = text_processed.lower().count(skill.lower())
        
        # Sort by frequency and return top skills
        sorted_skills = sorted(skill_scores.items(), key=lambda x: x[1], reverse=True)
        return [skill for skill, score in sorted_skills[:15]]  # Top 15 skills
    
    return list(set(found_skills))

def extract_gpa(text):
    """Extract GPA from resume text"""
    gpa_patterns = [
        r'gpa[:\s]*(\d+\.?\d*)',
        r'grade point average[:\s]*(\d+\.?\d*)',
        r'cumulative gpa[:\s]*(\d+\.?\d*)',
        r'overall gpa[:\s]*(\d+\.?\d*)',
        r'(\d+\.?\d*)\s*/\s*4\.0',
        r'(\d+\.?\d*)\s*gpa'
    ]
    
    text_lower = text.lower()
    for pattern in gpa_patterns:
        match = re.search(pattern, text_lower)
        if match:
            try:
                gpa = float(match.group(1))
                if 0.0 <= gpa <= 4.0:
                    return gpa
            except:
                continue
    
    return None

def extract_education_level(text):
    """Determine education level from resume"""
    text_lower = text.lower()
    
    grad_indicators = ['master', 'mba', 'phd', 'doctorate', 'graduate', 'ms ', 'ma ', 'meng']
    undergrad_indicators = ['bachelor', 'bs ', 'ba ', 'undergraduate', 'college student']
    
    if any(indicator in text_lower for indicator in grad_indicators):
        return 'graduate'
    elif any(indicator in text_lower for indicator in undergrad_indicators):
        return 'undergraduate'
    
    return 'undergraduate'  # Default assumption

def calculate_riasec_vector(text_processed, personal_statement):
    """Calculate RIASEC personality vector using keyword mapping and cosine similarity"""
    # Initialize RIASEC scores
    riasec_scores = {
        "realistic": 0,
        "investigative": 0, 
        "artistic": 0,
        "social": 0,
        "enterprising": 0,
        "conventional": 0
    }
    
    combined_text = (text_processed + " " + personal_statement).lower()
    
    # Map keywords to RIASEC dimensions
    for keyword, vector in riasec_mappings.items():
        if keyword in combined_text:
            keyword_frequency = combined_text.count(keyword)
            for dimension, score in vector.items():
                riasec_scores[dimension] += score * keyword_frequency
    
    # Normalize scores to 0-100 range
    max_score = max(riasec_scores.values()) if max(riasec_scores.values()) > 0 else 1
    normalized_scores = {k: (v / max_score) * 100 for k, v in riasec_scores.items()}
    
    return normalized_scores

def analyze_demographics(text, personal_statement):
    """Detect potential demographic indicators (carefully and respectfully)"""
    demographics = []
    combined_text = (text + " " + personal_statement).lower()
    
    # First-generation college indicators
    first_gen_indicators = [
        'first generation', 'first-generation', 'first in family', 'first to attend college',
        'parents did not attend college', 'family never went to college'
    ]
    if any(indicator in combined_text for indicator in first_gen_indicators):
        demographics.append('first-generation')
    
    # Military/veteran indicators
    military_indicators = [
        'military', 'veteran', 'army', 'navy', 'air force', 'marines', 'coast guard',
        'deployed', 'served in', 'military service'
    ]
    if any(indicator in combined_text for indicator in military_indicators):
        demographics.append('military/veteran')
    
    # STEM indicators
    stem_indicators = [
        'stem', 'science', 'technology', 'engineering', 'mathematics', 'computer',
        'programming', 'research', 'laboratory', 'coding'
    ]
    if any(indicator in combined_text for indicator in stem_indicators):
        demographics.append('STEM student')
    
    return demographics

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        resume_text = input_data.get("resume", "")
        personal_statement = input_data.get("statement", "")
        
        # Combine texts for analysis
        combined_text = resume_text + "\n" + personal_statement
        
        # Preprocess text
        text_processed = preprocess_text(combined_text)
        
        # Extract GPA
        extracted_gpa = extract_gpa(combined_text)
        
        # Determine education level
        education_level = extract_education_level(combined_text)
        
        # Calculate RIASEC personality vector using advanced mapping
        riasec_vector = calculate_riasec_vector(text_processed, personal_statement)
        
        # Calculate career matches using enhanced algorithm
        career_matches = calculate_career_matches(text_processed)
        sorted_careers = sorted(career_matches.items(), key=lambda x: x[1], reverse=True)
        
        # Map career matches to interests using RIASEC dimensions
        top_interests = []
        for career, score in sorted_careers[:5]:
            if score > 0:
                # Convert career field to interest category
                interest_mapping = {
                    "Artificial Intelligence & Machine Learning": "technology",
                    "Software Development": "software", 
                    "Data Science": "research",
                    "Cybersecurity": "technology",
                    "Healthcare": "healthcare",
                    "Business & Finance": "business",
                    "Education": "education",
                    "Engineering": "engineering"
                }
                interest = interest_mapping.get(career, career.lower())
                if interest not in top_interests:
                    top_interests.append(interest)
        
        # Extract skills using FlashText enhanced algorithm
        found_skills = extract_skills(text_processed)
        top_skills = found_skills[:10]  # Top 10 skills for better matching
        
        # Analyze demographics
        demographics = analyze_demographics(combined_text, personal_statement)
        
        # Calculate analysis confidence based on data richness
        confidence_score = 0
        if extracted_gpa: confidence_score += 25
        if len(top_skills) >= 3: confidence_score += 25
        if len(top_interests) >= 2: confidence_score += 25
        if len(text_processed.split()) > 50: confidence_score += 25
        
        confidence_level = 'high' if confidence_score >= 75 else 'medium' if confidence_score >= 50 else 'low'
        
        # Prepare enhanced result with RIASEC integration
        result = {
            "interests": top_interests,
            "skills": top_skills,
            "gpa": extracted_gpa,
            "education_level": education_level,
            "demographics": demographics,
            "analysis_confidence": confidence_level
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        # Return error in JSON format
        error_result = {
            "error": str(e),
            "interests": [],
            "skills": [],
            "gpa": None,
            "education_level": "undergraduate",
            "demographics": [],
            "analysis_confidence": "low"
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()