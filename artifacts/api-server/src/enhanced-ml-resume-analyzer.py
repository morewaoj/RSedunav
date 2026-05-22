#!/usr/bin/env python3
"""
Enhanced ML Resume Analyzer with FlashText + Advanced RIASEC + Career Embeddings
Uses scikit-learn for ML without heavy dependencies like sentence-transformers
"""
import sys
import json
import re
import numpy as np
from flashtext import KeywordProcessor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
import spacy

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    nlp = None

# Initialize FlashText processors
skill_processor = KeywordProcessor(case_sensitive=False)
career_processor = KeywordProcessor(case_sensitive=False)

# Comprehensive skill dictionary for FlashText
COMPREHENSIVE_SKILLS = [
    # Technical Skills
    "python", "javascript", "java", "c++", "sql", "html", "css", "react", "node.js",
    "aws", "azure", "docker", "kubernetes", "git", "linux", "windows", "mongodb",
    "postgresql", "mysql", "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn",
    "machine learning", "deep learning", "data analysis", "data science", "big data",
    "cloud computing", "devops", "ci/cd", "microservices", "api development",
    "cybersecurity", "network security", "penetration testing", "firewall", "encryption",
    "excel", "power bi", "tableau", "photoshop", "illustrator", "autocad", "solidworks",
    
    # Soft Skills
    "leadership", "teamwork", "communication", "problem-solving", "critical thinking",
    "project management", "time management", "analytical thinking", "creativity",
    "adaptability", "collaboration", "presentation", "negotiation", "mentoring",
    
    # Industry-Specific Skills
    "healthcare", "nursing", "medical", "teaching", "education", "marketing", "sales",
    "finance", "accounting", "legal", "law", "engineering", "research", "design"
]

# Load career database from JSON file
def load_career_database():
    """Load career profiles from JSON database"""
    try:
        import os
        career_db_path = os.path.join(os.path.dirname(__file__), 'career_db.json')
        with open(career_db_path, 'r') as f:
            data = json.load(f)
        
        career_profiles = {}
        for career in data['careers']:
            # Convert RIASEC vector array to dictionary
            riasec_dict = {
                "realistic": career['riasec_vector'][0],
                "investigative": career['riasec_vector'][1], 
                "artistic": career['riasec_vector'][2],
                "social": career['riasec_vector'][3],
                "enterprising": career['riasec_vector'][4],
                "conventional": career['riasec_vector'][5]
            }
            
            career_profiles[career['title']] = {
                "riasec": riasec_dict,
                "keywords": career['skills'],
                "education": career['education_required'],
                "salary": career['salary'],
                "growth_rate": career['growth_rate'],
                "onet_code": career['onet_code'],
                "description": career['description'],
                "min_gpa": career.get('min_gpa', 2.0)
            }
        
        return career_profiles
    except Exception as e:
        print(f"Error loading career database: {e}", file=sys.stderr)
        # Fallback to basic profiles if JSON loading fails
        return {
            "Software Engineer": {
                "riasec": {"realistic": 20, "investigative": 85, "artistic": 45, "social": 25, "enterprising": 30, "conventional": 40},
                "keywords": ["python", "javascript", "software", "programming"],
                "education": "bachelor",
                "salary": 95000,
                "growth_rate": "22%",
                "onet_code": "15-1252.00",
                "description": "Design and develop software applications",
                "min_gpa": 3.0
            }
        }

def initialize_processors():
    """Initialize FlashText processors with skill and career keywords"""
    # Add skills to processor
    for skill in COMPREHENSIVE_SKILLS:
        skill_processor.add_keyword(skill.lower())
        # Add variations
        skill_processor.add_keyword(skill.replace(" ", "").lower(), skill)
        skill_processor.add_keyword(skill.replace(" ", "-").lower(), skill)
    
    # Add career keywords to processor
    career_profiles = load_career_database()
    for career, profile in career_profiles.items():
        for keyword in profile["keywords"]:
            career_processor.add_keyword(keyword.lower(), career)

def extract_skills_advanced(text):
    """Extract skills using FlashText with frequency weighting"""
    skills_found = skill_processor.extract_keywords(text.lower())
    
    if not skills_found:
        return []
    
    # Calculate skill frequency and relevance
    skill_scores = {}
    for skill in skills_found:
        frequency = text.lower().count(skill.lower())
        skill_scores[skill] = frequency
    
    # Sort by frequency and return top skills
    sorted_skills = sorted(skill_scores.items(), key=lambda x: x[1], reverse=True)
    return [skill for skill, score in sorted_skills[:12]]

def calculate_riasec_profile(text, personal_statement=""):
    """Calculate user's RIASEC profile from text analysis"""
    combined_text = (text + " " + personal_statement).lower()
    
    # RIASEC keyword mappings
    riasec_keywords = {
        "realistic": ["build", "construct", "repair", "mechanical", "hands-on", "technical", "engineering", "manufacturing"],
        "investigative": ["research", "analyze", "study", "investigate", "science", "data", "problem", "theory"],
        "artistic": ["create", "design", "art", "creative", "innovative", "aesthetic", "visual", "graphic"],
        "social": ["help", "teach", "counsel", "community", "people", "social", "healthcare", "education"],
        "enterprising": ["lead", "manage", "business", "sell", "entrepreneurial", "leadership", "marketing", "strategy"],
        "conventional": ["organize", "detail", "systematic", "data entry", "administrative", "accounting", "finance"]
    }
    
    riasec_scores = {}
    for dimension, keywords in riasec_keywords.items():
        score = sum(combined_text.count(keyword) for keyword in keywords)
        riasec_scores[dimension] = score
    
    # Normalize scores
    total_score = sum(riasec_scores.values())
    if total_score > 0:
        riasec_scores = {k: (v / total_score) * 100 for k, v in riasec_scores.items()}
    
    return riasec_scores

def calculate_career_matches(text, personal_statement, user_riasec):
    """Calculate career matches using advanced ML scoring with JSON database"""
    career_profiles = load_career_database()
    career_scores = {}
    
    for career, profile in career_profiles.items():
        # 1. RIASEC Compatibility (40% weight)
        riasec_similarity = calculate_riasec_similarity(user_riasec, profile["riasec"])
        
        # 2. Keyword Match Score (35% weight)
        keyword_score = 0
        for keyword in profile["keywords"]:
            if keyword in text.lower():
                keyword_score += text.lower().count(keyword)
        keyword_score = min(keyword_score / len(profile["keywords"]) * 100, 100)
        
        # 3. Skills Alignment (25% weight)
        user_skills = extract_skills_advanced(text)
        skill_overlap = len(set(user_skills) & set(profile["keywords"]))
        skills_score = (skill_overlap / max(len(profile["keywords"]), 1)) * 100
        
        # Calculate weighted final score
        final_score = (
            riasec_similarity * 0.40 +
            keyword_score * 0.35 +
            skills_score * 0.25
        )
        
        career_scores[career] = {
            "total_score": round(final_score, 2),
            "riasec_match": round(riasec_similarity, 2),
            "keyword_match": round(keyword_score, 2),
            "skills_match": round(skills_score, 2),
            "salary": profile.get("salary", 50000),
            "growth_rate": profile.get("growth_rate", "5%"),
            "education": profile["education"],
            "onet_code": profile["onet_code"],
            "description": profile.get("description", "")
        }
    
    return career_scores

def calculate_riasec_similarity(user_riasec, career_riasec):
    """Calculate cosine similarity between RIASEC profiles"""
    user_vector = np.array([user_riasec.get(dim, 0) for dim in ["realistic", "investigative", "artistic", "social", "enterprising", "conventional"]])
    career_vector = np.array([career_riasec.get(dim, 0) for dim in ["realistic", "investigative", "artistic", "social", "enterprising", "conventional"]])
    
    # Cosine similarity
    if np.linalg.norm(user_vector) == 0 or np.linalg.norm(career_vector) == 0:
        return 0
    
    similarity = np.dot(user_vector, career_vector) / (np.linalg.norm(user_vector) * np.linalg.norm(career_vector))
    return max(0, similarity * 100)

def extract_gpa(text):
    """Extract GPA with improved patterns"""
    gpa_patterns = [
        r'gpa[:\s]*([0-4]\.\d{1,2})',
        r'grade point average[:\s]*([0-4]\.\d{1,2})',
        r'cumulative[:\s]*([0-4]\.\d{1,2})',
        r'(\d\.\d{1,2})\s*/\s*4\.0',
        r'(\d\.\d{1,2})\s*gpa'
    ]
    
    for pattern in gpa_patterns:
        match = re.search(pattern, text.lower())
        if match:
            try:
                gpa = float(match.group(1))
                if 0.0 <= gpa <= 4.0:
                    return gpa
            except:
                continue
    return None

def determine_education_level(text):
    """Determine education level with improved detection"""
    text_lower = text.lower()
    
    if any(term in text_lower for term in ["phd", "doctorate", "doctoral"]):
        return "doctorate"
    elif any(term in text_lower for term in ["master", "mba", "ms ", "ma ", "meng"]):
        return "master"
    elif any(term in text_lower for term in ["bachelor", "bs ", "ba ", "undergraduate"]):
        return "bachelor"
    elif any(term in text_lower for term in ["associate", "aa ", "as "]):
        return "associate"
    else:
        return "bachelor"  # Default assumption

def calculate_analysis_confidence(skills, gpa, education, text_length):
    """Calculate confidence level based on data richness"""
    confidence_score = 0
    
    if len(skills) >= 5: confidence_score += 30
    elif len(skills) >= 3: confidence_score += 20
    elif len(skills) >= 1: confidence_score += 10
    
    if gpa: confidence_score += 25
    if education != "bachelor": confidence_score += 15  # Non-default education
    if text_length > 100: confidence_score += 20
    if text_length > 200: confidence_score += 10
    
    if confidence_score >= 75: return "high"
    elif confidence_score >= 50: return "medium"
    else: return "low"

def load_scholarship_database():
    """Load scholarship data from JSON file"""
    try:
        import os
        scholarship_db_path = os.path.join(os.path.dirname(__file__), 'scholarship_db.json')
        with open(scholarship_db_path, 'r') as f:
            data = json.load(f)
        return data['scholarships']
    except Exception as e:
        print(f"Error loading scholarship database: {e}", file=sys.stderr)
        return []

def find_matching_scholarships(user_profile):
    """Find scholarships that match user profile"""
    scholarships = load_scholarship_database()
    matches = []
    
    user_gpa = user_profile.get('gpa', 0)
    user_interests = user_profile.get('interests', [])
    user_demographics = user_profile.get('demographics', [])
    user_education = user_profile.get('education_level', 'bachelor')
    
    for scholarship in scholarships:
        match_score = 0
        match_reasons = []
        
        # GPA requirement check
        if user_gpa >= scholarship.get('min_gpa', 0):
            match_score += 40
            match_reasons.append(f"Meets GPA requirement ({scholarship.get('min_gpa', 0)})")
        
        # Field/interest matching
        scholarship_field = scholarship.get('field', '').lower()
        if scholarship_field == 'general' or any(interest.lower() in scholarship_field or scholarship_field in interest.lower() for interest in user_interests):
            match_score += 30
            match_reasons.append(f"Field alignment with {scholarship_field}")
        
        # Demographics matching
        target_demos = scholarship.get('target_demographics', [])
        for demo in target_demos:
            if any(demo.lower() in user_demo.lower() for user_demo in user_demographics):
                match_score += 20
                match_reasons.append(f"Demographic match: {demo}")
                break
        
        # Education level check
        if user_education == 'graduate' and 'graduate' in target_demos:
            match_score += 10
            match_reasons.append("Graduate student eligibility")
        elif user_education in ['bachelor', 'undergraduate'] and 'undergraduate' in target_demos:
            match_score += 10
            match_reasons.append("Undergraduate eligibility")
        
        if match_score >= 40:  # Minimum threshold for recommendation
            matches.append({
                "scholarship": scholarship,
                "match_score": match_score,
                "match_reasons": match_reasons[:3]  # Top 3 reasons
            })
    
    return sorted(matches, key=lambda x: x['match_score'], reverse=True)[:5]

def main():
    try:
        # Initialize processors
        initialize_processors()
        
        # Get input data
        input_data = json.loads(sys.stdin.read())
        resume_text = input_data.get("resume", "")
        personal_statement = input_data.get("statement", "")
        
        combined_text = resume_text + " " + personal_statement
        
        # Extract basic information
        skills = extract_skills_advanced(combined_text)
        gpa = extract_gpa(combined_text)
        education_level = determine_education_level(combined_text)
        
        # Calculate RIASEC profile
        user_riasec = calculate_riasec_profile(resume_text, personal_statement)
        
        # Calculate career matches
        career_matches = calculate_career_matches(combined_text, personal_statement, user_riasec)
        
        # Sort careers by score
        sorted_careers = sorted(career_matches.items(), key=lambda x: x[1]["total_score"], reverse=True)
        
        # Extract top interests from career matches
        top_interests = []
        for career, data in sorted_careers[:5]:
            if data["total_score"] > 30:  # Minimum threshold
                # Map careers to broader interest categories
                if any(keyword in career.lower() for keyword in ['software', 'data', 'cyber']):
                    interest = "technology"
                elif any(keyword in career.lower() for keyword in ['nurse', 'medical', 'health']):
                    interest = "healthcare"
                elif any(keyword in career.lower() for keyword in ['business', 'manager', 'marketing']):
                    interest = "business"
                elif any(keyword in career.lower() for keyword in ['engineer', 'mechanical']):
                    interest = "engineering"
                elif any(keyword in career.lower() for keyword in ['teacher', 'education']):
                    interest = "education"
                else:
                    interest = career.lower().replace(" ", "_")
                
                if interest not in top_interests:
                    top_interests.append(interest)
        
        # Detect demographics (basic analysis)
        demographics = []
        combined_lower = combined_text.lower()
        if any(term in combined_lower for term in ['military', 'veteran', 'army', 'navy']):
            demographics.append('military/veteran')
        if any(term in combined_lower for term in ['first generation', 'first-generation']):
            demographics.append('first-generation')
        if any(term in combined_lower for term in ['stem', 'science', 'technology']):
            demographics.append('STEM student')
        
        # Calculate confidence
        confidence = calculate_analysis_confidence(skills, gpa, education_level, len(combined_text))
        
        # Find scholarship matches
        user_profile = {
            'gpa': gpa,
            'interests': top_interests,
            'demographics': demographics,
            'education_level': education_level
        }
        scholarship_matches = find_matching_scholarships(user_profile)
        
        # Prepare result
        result = {
            "interests": top_interests[:5],
            "skills": skills[:10],
            "gpa": gpa,
            "education_level": education_level,
            "demographics": demographics,
            "analysis_confidence": confidence,
            "riasec_profile": user_riasec,
            "career_matches": dict(sorted_careers[:5]),
            "scholarship_matches": scholarship_matches,
            "top_career_recommendation": sorted_careers[0][0] if sorted_careers else None
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "interests": [],
            "skills": [],
            "gpa": None,
            "education_level": "bachelor",
            "demographics": [],
            "analysis_confidence": "low",
            "error": str(e)
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()