#!/usr/bin/env python3
"""
FINAL FIXED RESUME ANALYZER WITH ACCURATE RIASEC AND SKILLS MATCHING
Provides clean, accurate career matching for all resume types with debug-friendly output
"""

import json
import sys
import re
import numpy as np
from flashtext import KeywordProcessor
from difflib import get_close_matches

# Setup skill extractor
skill_extractor = KeywordProcessor()

# Comprehensive skills across all career types
ALL_SKILLS = [
    # Technology
    "python", "sql", "aws", "linux", "data analysis", "project management", "excel",
    "javascript", "java", "c++", "html", "css", "react", "nodejs", "docker", "kubernetes",
    "machine learning", "ai", "cloud computing", "database", "cybersecurity", "git",
    
    # Healthcare
    "patient care", "emergency care", "triage", "nursing", "diagnosis", "ehr", "pharmacy",
    "medical terminology", "vital signs", "medication", "clinical skills", "health records",
    "surgery prep", "rehabilitation", "therapy", "mental health", "hipaa", "charting",
    
    # Business & Finance
    "marketing", "sales", "finance", "accounting", "business analysis", "crm", "budgeting",
    "financial planning", "investment", "strategic planning", "market research", "consulting",
    "operations", "supply chain", "procurement", "risk management", "compliance",
    
    # Creative & Design
    "graphic design", "web design", "ui/ux", "photoshop", "illustrator", "creative writing",
    "content creation", "branding", "photography", "video editing", "animation", "storytelling",
    
    # Education & Legal
    "teaching", "curriculum", "training", "legal research", "contract review", "litigation",
    "paralegal", "case management", "intellectual property", "regulatory compliance",
    
    # General Skills
    "communication", "leadership", "teamwork", "problem solving", "time management",
    "customer service", "documentation", "presentation", "negotiation", "organization"
]

skill_extractor.add_keywords_from_list(ALL_SKILLS)

# Comprehensive RIASEC mapping for all career types
RIASEC_KEYWORDS = {
    "Realistic": ["build", "install", "machinery", "engineer", "repair", "operate", "tools", "mechanical", "construction", "manufacturing"],
    "Investigative": ["research", "analyze", "science", "diagnose", "data", "problem-solving", "laboratory", "testing", "investigation"],
    "Artistic": ["design", "creative", "paint", "write", "innovate", "draw", "photography", "video", "animation", "storytelling"],
    "Social": ["care", "help", "educate", "nurse", "teach", "support", "counsel", "therapy", "social work", "community"],
    "Enterprising": ["lead", "sales", "negotiate", "startups", "business", "influence", "management", "marketing", "entrepreneurship"],
    "Conventional": ["organize", "data entry", "document", "plan", "administrate", "records", "accounting", "filing", "systematic"]
}

# Load career database
try:
    with open('career_db.json') as f:
        careers_data = json.load(f)
        careers = careers_data.get('careers', careers_data) if isinstance(careers_data, dict) else careers_data
except:
    careers = []

# Load scholarship database  
try:
    with open('scholarship_db.json') as f:
        scholarship_data = json.load(f)
        scholarships = scholarship_data.get('scholarships', scholarship_data) if isinstance(scholarship_data, dict) else scholarship_data
except:
    scholarships = []

# Helper Functions
def cosine(v1, v2):
    """Calculate cosine similarity between vectors"""
    v1, v2 = np.array(v1), np.array(v2)
    if not np.any(v1) or not np.any(v2):
        return 0.0
    return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))

def extract_gpa(text):
    """Extract GPA from resume text"""
    match = re.search(r"gpa[:\s]*([0-4]\.?\d{0,2})", text.lower())
    return float(match.group(1)) if match else None

def determine_education_level(text):
    """Determine education level from text"""
    text = text.lower()
    if "phd" in text or "doctorate" in text: return "Doctorate"
    if "master" in text: return "Master's"
    if "bachelor" in text: return "Bachelor's"
    return "Unknown"

def compute_riasec_vector(text):
    """Compute RIASEC personality vector from text"""
    vector = [0] * 6
    text = text.lower()
    for i, domain in enumerate(["Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional"]):
        vector[i] = sum(text.count(word) for word in RIASEC_KEYWORDS[domain])
    max_val = max(vector) if max(vector) > 0 else 1
    return [round(v / max_val, 2) for v in vector]

def fuzzy_match(skills, target):
    """Perform fuzzy matching for skills"""
    matched = set()
    for skill in skills:
        match = get_close_matches(skill, target, n=1, cutoff=0.85)
        if match: matched.add(match[0])
    return matched

# Main Career Matcher
def match_careers(resume_text, personal_statement):
    """Main career matching function with clean output"""
    full_text = resume_text + " " + personal_statement
    resume_skills = set(skill_extractor.extract_keywords(full_text.lower()))
    user_riasec = compute_riasec_vector(full_text)
    gpa = extract_gpa(full_text)
    edu = determine_education_level(full_text)

    results = []
    for c in careers:
        # Normalize skills for matching
        career_skills = set([s.lower() for s in c.get("skills", [])])
        matched_skills = resume_skills & career_skills
        fuzzy = fuzzy_match(resume_skills, career_skills)
        total_matches = matched_skills | fuzzy

        # Calculate component scores
        skill_score = len(total_matches) / max(1, len(career_skills))
        riasec_score = cosine(user_riasec, c.get("riasec_vector", [0]*6))
        edu_score = 1.0 if edu == c.get("education", "") else 0.5 if edu != "Unknown" else 0
        salary_score = 1.0 if c.get("salary", 0) >= 60000 else 0.5

        # Apply weighted formula
        final_score = round(
            riasec_score * 0.4 +
            skill_score * 0.3 +
            edu_score * 0.15 +
            salary_score * 0.15, 4
        )

        results.append({
            "career": c.get("title", "Unknown"),
            "score": round(final_score * 100, 2),
            "matched_skills": list(total_matches),
            "salary": c.get("salary", 50000),
            "growth": c.get("growth_rate", "5%"),
            "riasec_match": round(riasec_score * 100, 2),
            "skills_match": round(skill_score * 100, 2),
            "education_match": round(edu_score * 100, 2),
            "onet_code": c.get("onet_code", "N/A"),
            "description": c.get("description", ""),
            "skills_overlap": len(total_matches),
            "career_skills_total": len(career_skills)
        })

    return sorted(results, key=lambda x: x["score"], reverse=True)[:5], list(resume_skills), gpa, edu, user_riasec

def match_scholarships(user_gpa, user_interests):
    """Match scholarships based on GPA and interests"""
    matches = []
    for s in scholarships:
        if user_gpa and user_gpa >= s.get("min_gpa", 0) and any(field in user_interests for field in s.get("fields", [])):
            matches.append({
                "title": s.get("title", "Unknown"),
                "amount": s.get("amount", 0),
                "link": s.get("link", "")
            })
    return matches[:5]

def analyze(resume_text, personal_statement):
    """Main analysis function with clean JSON output"""
    careers_result, skills, gpa, edu, riasec = match_careers(resume_text, personal_statement)
    scholarships_matched = match_scholarships(gpa or 3.0, skills)
    
    # Calculate confidence
    confidence_score = min(len(skills) * 4, 40)
    if gpa is not None: confidence_score += 20
    if edu != "Unknown": confidence_score += 20
    if len(resume_text + personal_statement) >= 500: confidence_score += 20
    
    confidence = "high" if confidence_score >= 75 else "medium" if confidence_score >= 50 else "low"
    
    return {
        "careers": careers_result,
        "skills": skills,
        "gpa": gpa,
        "education_level": edu,
        "riasec_profile": riasec,
        "scholarships": scholarships_matched,
        "analysis_confidence": confidence,
        "career_matches": {career["career"]: {
            "total_score": career["score"],
            "riasec_match": career["riasec_match"],
            "skills_match": career["skills_match"],
            "education_match": career["education_match"],
            "salary": career["salary"],
            "growth_rate": career["growth"],
            "onet_code": career["onet_code"],
            "description": career["description"],
            "skills_overlap": career["skills_overlap"],
            "career_skills_total": career["career_skills_total"],
            "education": edu
        } for career in careers_result},
        "debug_info": {
            "total_careers_analyzed": len(careers_result),
            "skills_found": len(skills),
            "riasec_total": sum(riasec)
        }
    }

def main():
    """Main function for command line usage"""
    try:
        # Get input data
        input_data = json.loads(sys.stdin.read())
        resume_text = input_data.get("resume", "")
        personal_statement = input_data.get("statement", "")
        
        # Use the clean analyze function
        result = analyze(resume_text, personal_statement)
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            "interests": [],
            "skills": [],
            "gpa": None,
            "education_level": "Bachelor's",
            "demographics": [],
            "analysis_confidence": "low",
            "error": str(e)
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()