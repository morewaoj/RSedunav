#!/usr/bin/env python3
"""
FINAL FIXED RESUME ANALYZER WITH ACCURATE RIASEC AND SKILLS MATCHING
Provides clean, accurate career matching for all resume types with debug-friendly output
"""

import json
import sys
import re
import os
import requests
import numpy as np
from flashtext import KeywordProcessor
from difflib import get_close_matches
from typing import Dict, List, Tuple, Any

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

# Simplified but comprehensive RIASEC mapping
RIASEC_KEYWORDS = {
    "Realistic": ["build", "install", "machinery", "engineer", "repair", "operate", "tools", "mechanical", "construction", "manufacturing"],
    "Investigative": ["research", "analyze", "science", "diagnose", "data", "problem-solving", "laboratory", "testing", "investigation"],
    "Artistic": ["design", "creative", "paint", "write", "innovate", "draw", "photography", "video", "animation", "storytelling"],
    "Social": ["care", "help", "educate", "nurse", "teach", "support", "counsel", "therapy", "social work", "community"],
    "Enterprising": ["lead", "sales", "negotiate", "startups", "business", "influence", "management", "marketing", "entrepreneurship"],
    "Conventional": ["organize", "data entry", "document", "plan", "administrate", "records", "accounting", "filing", "systematic"]
}

# Load databases
try:
    with open('career_db.json') as f:
        careers = json.load(f)
except:
    careers = []

try:
    with open('scholarship_db.json') as f:
        scholarships = json.load(f)
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
        career_skills = set([s.lower() for s in c["skills"]])
        matched_skills = resume_skills & career_skills
        fuzzy = fuzzy_match(resume_skills, career_skills)
        total_matches = matched_skills | fuzzy

        # Calculate component scores
        skill_score = len(total_matches) / max(1, len(career_skills))
        riasec_score = cosine(user_riasec, c["riasec_vector"])
        edu_score = 1.0 if edu == c["education"] else 0.5 if edu != "Unknown" else 0
        salary_score = 1.0 if c["salary"] >= 60000 else 0.5

        # Apply weighted formula
        final_score = round(
            riasec_score * 0.4 +
            skill_score * 0.3 +
            edu_score * 0.15 +
            salary_score * 0.15, 4
        )

        results.append({
            "career": c["title"],
            "score": round(final_score * 100, 2),
            "matched_skills": list(total_matches),
            "salary": c["salary"],
            "growth": c["growth_rate"],
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
        if user_gpa and user_gpa >= s["min_gpa"] and any(field in user_interests for field in s["fields"]):
            matches.append({
                "title": s["title"],
                "amount": s["amount"],
                "link": s["link"]
            })
    return matches[:5]

def analyze(resume_text, personal_statement):
    """Main analysis function with clean JSON output"""
    careers, skills, gpa, edu, riasec = match_careers(resume_text, personal_statement)
    scholarships_matched = match_scholarships(gpa or 3.0, skills)
    return {
        "careers": careers,
        "skills": skills,
        "gpa": gpa,
        "education_level": edu,
        "riasec_profile": riasec,
        "scholarships": scholarships_matched,
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
            "career_skills_total": career["career_skills_total"]
        } for career in careers},
        "debug_info": {
            "total_careers_analyzed": len(careers),
            "skills_found": len(skills),
            "riasec_total": sum(riasec)
        }
    }

def match_schools_college_scorecard(api_key, gpa, education_level, desired_degree, state_preference=None):
    """Match schools using College Scorecard API"""
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
        "fields": "school.name,school.state,school.city,latest.cost.attendance.academic_year,latest.completion.completion_rate_4yr,latest.earnings.10_yrs_after_entry",
        f"latest.academics.program_available.assoc": 1 if deg_code == 2 else None,
        f"latest.academics.program_available.bachelors": 1 if deg_code == 3 else None,
        f"latest.academics.program_available.graduate": 1 if deg_code >= 4 else None,
        "per_page": 25
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
            
            grad_rate = school.get("latest.completion.completion_rate_4yr") or 0
            earnings = school.get("latest.earnings.10_yrs_after_entry") or 0
            cost = school.get("latest.cost.attendance.academic_year") or 1
            
            # Calculate match score
            grad_score = grad_rate * 0.5
            earnings_score = min(earnings / 60000, 1) * 0.3
            cost_score = max(0, (40000 - cost) / 40000) * 0.2
            
            total_score = grad_score + earnings_score + cost_score
            
            schools.append({
                "name": name,
                "state": state,
                "graduation_rate": round(grad_rate * 100, 1) if grad_rate else 0,
                "median_earnings": earnings,
                "annual_cost": cost,
                "match_score": round(total_score * 100, 2)
            })
        
        return sorted(schools, key=lambda x: x["match_score"], reverse=True)[:5]
    
    except Exception as e:
        print(f"College Scorecard API error: {e}", file=sys.stderr)
        return []

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