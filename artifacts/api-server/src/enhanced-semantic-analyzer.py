#!/usr/bin/env python3
"""
Enhanced ML Resume Analyzer with Semantic Analysis + College Scorecard Integration
Uses scikit-learn TF-IDF for semantic similarity and authentic data sources
"""

import json
import sys
import re
import os
import requests
from typing import Dict, List, Tuple, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from flashtext import KeywordProcessor

# Initialize processors
skill_processor = KeywordProcessor()
career_processor = KeywordProcessor()

# Comprehensive skills database
COMPREHENSIVE_SKILLS = [
    "python", "javascript", "java", "c++", "sql", "html", "css", "react", "node.js",
    "aws", "docker", "kubernetes", "linux", "git", "machine learning", "data analysis",
    "pandas", "numpy", "tensorflow", "pytorch", "excel", "power bi", "tableau",
    "project management", "leadership", "communication", "problem solving",
    "critical thinking", "teamwork", "creativity", "analytical thinking",
    "time management", "adaptability", "attention to detail", "customer service",
    "marketing", "sales", "finance", "accounting", "business analysis",
    "healthcare", "nursing", "medical", "teaching", "education", "research", "design"
]

# RIASEC interest keywords mapping
RIASEC_KEYWORDS = {
    "realistic": ["mechanical", "engineering", "construction", "repair", "manufacturing", "tools", "equipment"],
    "investigative": ["research", "analysis", "science", "laboratory", "data", "investigation", "problem solving"],
    "artistic": ["creative", "design", "art", "music", "writing", "photography", "graphic", "aesthetic"],
    "social": ["teaching", "counseling", "healthcare", "social work", "helping", "communication", "teamwork"],
    "enterprising": ["leadership", "management", "sales", "business", "entrepreneurship", "persuasion", "negotiation"],
    "conventional": ["organization", "data entry", "accounting", "administration", "detail-oriented", "systematic"]
}

def load_career_database():
    """Load career profiles from JSON database"""
    try:
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
        return {}

def load_scholarship_database():
    """Load scholarship data from JSON file"""
    try:
        scholarship_db_path = os.path.join(os.path.dirname(__file__), 'scholarship_db.json')
        with open(scholarship_db_path, 'r') as f:
            data = json.load(f)
        return data['scholarships']
    except Exception as e:
        print(f"Error loading scholarship database: {e}", file=sys.stderr)
        return []

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

def extract_skills_semantic(text):
    """Extract skills using both FlashText and semantic analysis"""
    # FlashText extraction for exact matches
    skills_found = skill_processor.extract_keywords(text.lower())
    skills_dict = {}
    
    for skill in skills_found:
        skills_dict[skill] = skills_dict.get(skill, 0) + 1
    
    # TF-IDF semantic extraction for related skills
    try:
        vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english')
        skill_texts = [" ".join(COMPREHENSIVE_SKILLS), text.lower()]
        tfidf_matrix = vectorizer.fit_transform(skill_texts)
        similarity_scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0]
        
        # Add semantically similar skills
        feature_names = vectorizer.get_feature_names_out()
        for i, score in enumerate(similarity_scores):
            if score > 0.1:  # Threshold for semantic similarity
                term = feature_names[i] if i < len(feature_names) else ""
                if term in COMPREHENSIVE_SKILLS and term not in skills_dict:
                    skills_dict[term] = 1
    except Exception as e:
        print(f"Semantic analysis error: {e}", file=sys.stderr)
    
    # Return top skills by frequency
    return sorted(skills_dict.keys(), key=lambda x: skills_dict[x], reverse=True)[:15]

def calculate_riasec_profile_semantic(text, personal_statement=""):
    """Calculate enhanced RIASEC profile using semantic analysis"""
    combined_text = text + " " + personal_statement
    riasec_scores = {trait: 0.0 for trait in RIASEC_KEYWORDS.keys()}
    
    try:
        # Create TF-IDF vectors for each RIASEC category
        vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english')
        
        for trait, keywords in RIASEC_KEYWORDS.items():
            # Create reference text for this RIASEC trait
            trait_text = " ".join(keywords)
            texts = [trait_text, combined_text.lower()]
            
            tfidf_matrix = vectorizer.fit_transform(texts)
            similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            
            # Scale similarity to 0-100 and add keyword frequency bonus
            base_score = similarity * 100
            
            # Add frequency bonus for exact keyword matches
            keyword_count = sum(1 for keyword in keywords if keyword in combined_text.lower())
            frequency_bonus = (keyword_count / len(keywords)) * 20
            
            riasec_scores[trait] = min(100.0, float(base_score + frequency_bonus))
    
    except Exception as e:
        print(f"RIASEC semantic analysis error: {e}", file=sys.stderr)
        # Fallback to keyword-based scoring
        for trait, keywords in RIASEC_KEYWORDS.items():
            count = sum(1 for keyword in keywords if keyword in combined_text.lower())
            riasec_scores[trait] = float((count / len(keywords)) * 100)
    
    return riasec_scores

def calculate_career_matches_semantic(text, personal_statement, user_riasec):
    """Calculate career matches using enhanced semantic analysis"""
    career_profiles = load_career_database()
    career_scores = {}
    
    combined_text = text + " " + personal_statement
    
    try:
        # Create TF-IDF vectorizer for career matching
        vectorizer = TfidfVectorizer(ngram_range=(1, 3), stop_words='english', max_features=1000)
        
        for career, profile in career_profiles.items():
            # 1. Semantic similarity with career description and keywords
            career_text = profile.get("description", "") + " " + " ".join(profile["keywords"])
            texts = [career_text, combined_text.lower()]
            
            try:
                tfidf_matrix = vectorizer.fit_transform(texts)
                semantic_similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0] * 100
            except:
                semantic_similarity = 0
            
            # 2. RIASEC Compatibility using cosine similarity
            user_vector = np.array(list(user_riasec.values()))
            career_vector = np.array(list(profile["riasec"].values()))
            
            try:
                riasec_similarity = float(np.dot(user_vector, career_vector) / 
                                        (np.linalg.norm(user_vector) * np.linalg.norm(career_vector))) * 100
            except:
                riasec_similarity = 0
            
            # 3. Skills Match using FlashText
            user_skills = set(skill_processor.extract_keywords(combined_text.lower()))
            career_skills = set([skill.lower() for skill in profile["keywords"]])
            skills_overlap = len(user_skills & career_skills)
            skills_score = (skills_overlap / len(career_skills)) * 100 if career_skills else 0
            
            # 4. Education compatibility
            user_education = determine_education_level(combined_text)
            education_match = 100 if user_education.lower() in profile["education"].lower() else 50
            
            # 5. Weighted final score
            final_score = (
                riasec_similarity * 0.35 +
                semantic_similarity * 0.25 +
                skills_score * 0.25 +
                education_match * 0.15
            )
            
            career_scores[career] = {
                "total_score": round(final_score, 2),
                "riasec_match": round(riasec_similarity, 2),
                "semantic_match": round(semantic_similarity, 2),
                "skills_match": round(skills_score, 2),
                "education_match": round(education_match, 2),
                "salary": profile.get("salary", 50000),
                "growth_rate": profile.get("growth_rate", "5%"),
                "education": profile["education"],
                "onet_code": profile["onet_code"],
                "description": profile.get("description", "")
            }
    
    except Exception as e:
        print(f"Career matching error: {e}", file=sys.stderr)
    
    return career_scores

def match_schools_college_scorecard(api_key, gpa, education_level, desired_degree, state_preference=None):
    """Match schools using College Scorecard API with semantic analysis"""
    if not api_key:
        return []
    
    degree_codes = {
        "Associate's": 2,
        "Bachelor's": 3, 
        "Master's": 4,
        "Doctorate": 5
    }
    
    deg_code = degree_codes.get(desired_degree, 3)
    
    url = "https://api.data.gov/ed/collegescorecard/v1/schools"
    params = {
        "api_key": api_key,
        "fields": "school.name,school.state,school.city,latest.cost.attendance.academic_year,latest.completion.completion_rate_4yr,latest.earnings.10_yrs_after_entry,latest.admissions.sat_scores.average.overall",
        f"latest.academics.program_available.assoc": 1 if deg_code == 2 else None,
        f"latest.academics.program_available.bachelors": 1 if deg_code == 3 else None,
        f"latest.academics.program_available.graduate": 1 if deg_code >= 4 else None,
        "per_page": 50
    }
    
    # Filter by state if specified
    if state_preference:
        params["school.state"] = state_preference
    
    try:
        response = requests.get(url, params=params, timeout=10)
        results = response.json().get("results", [])
        
        schools = []
        for school in results:
            name = school.get("school.name", "Unknown")
            state = school.get("school.state", "Unknown")
            city = school.get("school.city", "Unknown")
            
            # Calculate match score based on various factors
            grad_rate = school.get("latest.completion.completion_rate_4yr") or 0
            earnings = school.get("latest.earnings.10_yrs_after_entry") or 0
            cost = school.get("latest.cost.attendance.academic_year") or 1
            sat_score = school.get("latest.admissions.sat_scores.average.overall") or 0
            
            # Normalize and weight factors
            grad_score = grad_rate * 0.3
            earnings_score = min(earnings / 80000, 1) * 0.25  # Normalize to max 80k
            cost_score = max(0, (50000 - cost) / 50000) * 0.25  # Lower cost = higher score
            sat_score_norm = (sat_score / 1600) * 0.2 if sat_score > 0 else 0
            
            total_score = grad_score + earnings_score + cost_score + sat_score_norm
            
            schools.append({
                "name": name,
                "state": state,
                "city": city,
                "graduation_rate": round(grad_rate * 100, 1) if grad_rate else 0,
                "median_earnings": earnings,
                "annual_cost": cost,
                "sat_average": sat_score,
                "match_score": round(total_score * 100, 2)
            })
        
        return sorted(schools, key=lambda x: x["match_score"], reverse=True)[:10]
    
    except Exception as e:
        print(f"College Scorecard API error: {e}", file=sys.stderr)
        return []

def find_matching_scholarships(user_profile):
    """Find scholarships using enhanced matching"""
    scholarships = load_scholarship_database()
    matches = []
    
    user_gpa = user_profile.get('gpa', 0) or 0
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
        
        # Field/interest matching with semantic analysis
        scholarship_field = scholarship.get('field', '').lower()
        if scholarship_field == 'general':
            match_score += 30
            match_reasons.append("General eligibility scholarship")
        else:
            # Check for field alignment
            for interest in user_interests:
                if (interest.lower() in scholarship_field or 
                    scholarship_field in interest.lower() or
                    (scholarship_field == 'stem' and any(stem_word in interest.lower() 
                     for stem_word in ['technology', 'engineering', 'science', 'math']))):
                    match_score += 30
                    match_reasons.append(f"Field alignment with {scholarship_field}")
                    break
        
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
        elif user_education in ['bachelor', 'undergraduate'] and any(
            term in target_demos for term in ['undergraduate', 'low-income']):
            match_score += 10
            match_reasons.append("Undergraduate eligibility")
        
        if match_score >= 40:  # Minimum threshold for recommendation
            matches.append({
                "scholarship": scholarship,
                "match_score": match_score,
                "match_reasons": match_reasons[:3]  # Top 3 reasons
            })
    
    return sorted(matches, key=lambda x: x['match_score'], reverse=True)[:5]

def extract_gpa(text):
    """Extract GPA with improved patterns"""
    patterns = [
        r"gpa[:\s]*([0-4]\.?\d{0,2})",
        r"grade point average[:\s]*([0-4]\.?\d{0,2})",
        r"cumulative gpa[:\s]*([0-4]\.?\d{0,2})",
        r"overall gpa[:\s]*([0-4]\.?\d{0,2})"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text.lower())
        if match:
            gpa_value = float(match.group(1))
            return gpa_value if 0 <= gpa_value <= 4.0 else None
    
    return None

def determine_education_level(text):
    """Determine education level with improved detection"""
    text_lower = text.lower()
    
    if any(word in text_lower for word in ["phd", "doctorate", "doctoral", "ph.d"]):
        return "Doctorate"
    elif any(word in text_lower for word in ["master", "masters", "m.s.", "m.a.", "mba", "graduate"]):
        return "Master's"
    elif any(word in text_lower for word in ["bachelor", "bachelors", "b.s.", "b.a.", "undergraduate"]):
        return "Bachelor's"
    elif any(word in text_lower for word in ["associate", "associates", "a.s.", "a.a."]):
        return "Associate's"
    else:
        return "Bachelor's"  # Default assumption

def calculate_analysis_confidence(skills, gpa, education, text_length):
    """Calculate confidence level based on data richness"""
    confidence_score = 0
    
    # Skills factor (0-40 points)
    confidence_score += min(len(skills) * 4, 40)
    
    # GPA factor (0-20 points)
    if gpa is not None:
        confidence_score += 20
    
    # Education factor (0-20 points)
    if education != "Bachelor's":  # Non-default education detected
        confidence_score += 20
    
    # Text length factor (0-20 points)
    if text_length >= 500:
        confidence_score += 20
    elif text_length >= 200:
        confidence_score += 10
    
    if confidence_score >= 75:
        return "high"
    elif confidence_score >= 50:
        return "medium"
    else:
        return "low"

def main():
    try:
        # Initialize processors
        initialize_processors()
        
        # Get input data
        input_data = json.loads(sys.stdin.read())
        resume_text = input_data.get("resume", "")
        personal_statement = input_data.get("statement", "")
        api_key = input_data.get("api_key", "")
        desired_degree = input_data.get("desired_degree", "Bachelor's")
        state_preference = input_data.get("state_preference")
        
        combined_text = resume_text + " " + personal_statement
        
        # Extract basic information using enhanced methods
        skills = extract_skills_semantic(combined_text)
        gpa = extract_gpa(combined_text)
        education_level = determine_education_level(combined_text)
        
        # Calculate enhanced RIASEC profile
        user_riasec = calculate_riasec_profile_semantic(resume_text, personal_statement)
        
        # Calculate career matches using semantic analysis
        career_matches = calculate_career_matches_semantic(combined_text, personal_statement, user_riasec)
        
        # Sort careers by score
        sorted_careers = sorted(career_matches.items(), key=lambda x: x[1]["total_score"], reverse=True)
        
        # Extract interests from top career matches
        top_interests = []
        for career, data in sorted_careers[:5]:
            if data["total_score"] > 30:
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
        
        # Enhanced demographic detection
        demographics = []
        combined_lower = combined_text.lower()
        if any(term in combined_lower for term in ['military', 'veteran', 'army', 'navy', 'marines']):
            demographics.append('military/veteran')
        if any(term in combined_lower for term in ['first generation', 'first-generation']):
            demographics.append('first-generation')
        if any(term in combined_lower for term in ['stem', 'science', 'technology', 'engineering']):
            demographics.append('STEM student')
        if gpa and gpa >= 3.5:
            demographics.append('high-achiever')
        
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
        
        # Find school matches using College Scorecard API
        school_matches = match_schools_college_scorecard(
            api_key, gpa, education_level, desired_degree, state_preference
        )
        
        # Prepare comprehensive result
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
            "school_matches": school_matches,
            "top_career_recommendation": sorted_careers[0][0] if sorted_careers else None,
            "semantic_analysis": True
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "interests": [],
            "skills": [],
            "gpa": None,
            "education_level": "Bachelor's",
            "demographics": [],
            "analysis_confidence": "low",
            "error": str(e),
            "semantic_analysis": False
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()