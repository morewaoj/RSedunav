#!/usr/bin/env python3
"""
SIMPLE CAREER ANALYZER WITHOUT NUMPY DEPENDENCIES
Provides accurate RIASEC and skills matching for all resume types
"""

import json
import sys
import re
import math
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

# RIASEC personality mapping
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
except Exception as e:
    print(f"Warning: Could not load career_db.json: {e}", file=sys.stderr)
    careers = []

# Load scholarship database  
try:
    with open('scholarship_data.json') as f:
        scholarship_data = json.load(f)
        scholarships = scholarship_data.get('scholarships', scholarship_data) if isinstance(scholarship_data, dict) else scholarship_data
        print(f"Loaded {len(scholarships)} scholarships from database", file=sys.stderr)
except Exception as e:
    print(f"Warning: Could not load scholarship_data.json: {e}", file=sys.stderr)
    scholarships = []

# Helper Functions
def cosine_similarity(v1, v2):
    """Calculate cosine similarity without numpy"""
    if not v1 or not v2:
        return 0.0
    
    dot_product = sum(a * b for a, b in zip(v1, v2))
    magnitude_v1 = math.sqrt(sum(a * a for a in v1))
    magnitude_v2 = math.sqrt(sum(b * b for b in v2))
    
    if magnitude_v1 == 0 or magnitude_v2 == 0:
        return 0.0
    
    return dot_product / (magnitude_v1 * magnitude_v2)

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
        riasec_score = cosine_similarity(user_riasec, c.get("riasec_vector", [0]*6))
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

def match_scholarships(user_gpa=None, user_interests=None, demographics=None, top_n=8):
    """Enhanced scholarship matching with flexible logic and better scoring"""
    user_interests = [i.lower() for i in (user_interests or [])]
    demographics = [d.lower() for d in (demographics or [])]

    # Use the already loaded scholarships from module initialization
    if not scholarships:
        print("No scholarships loaded from database", file=sys.stderr)
        return []
    
    print(f"Processing {len(scholarships)} scholarships for matching", file=sys.stderr)

    matches = []
    for s in scholarships:
        score = 0
        match_reasons = []

        # GPA match (optional but weighted)
        min_gpa = s.get("min_gpa", 0)
        if user_gpa and user_gpa >= min_gpa:
            score += 30
            match_reasons.append(f"Meets GPA requirement ({min_gpa})")
        elif not min_gpa:  # No GPA requirement
            score += 20
            match_reasons.append("No GPA requirement")

        # Interest match (partial match allowed)
        fields = [f.lower() for f in s.get("fields", [])]
        interest_match = False
        for ui in user_interests:
            for f in fields:
                if ui in f or f in ui:
                    score += 40
                    match_reasons.append(f"Field alignment: {f}")
                    interest_match = True
                    break
            if interest_match:
                break

        # Demographics match
        demo_tags = [d.lower() for d in s.get("demographics", [])]
        demo_match = False
        for d in demographics:
            for dt in demo_tags:
                if d in dt or dt in d:
                    score += 30
                    match_reasons.append(f"Demographic match: {d}")
                    demo_match = True
                    break
            if demo_match:
                break

        # General eligibility bonus
        if not interest_match and not demo_match and score >= 20:
            match_reasons.append("General eligibility scholarship")

        if score > 0:
            matches.append({
                "scholarship": {
                    "name": s.get("title", "Unknown"),
                    "amount": s.get("amount", 0),
                    "type": s.get("type", "merit-based"),
                    "provider": s.get("provider", "Unknown"),
                    "deadline": s.get("deadline", "Check website"),
                    "description": s.get("description", "Scholarship opportunity"),
                    "website": s.get("link", "")
                },
                "score": score,
                "matchReasons": match_reasons[:3],  # Limit to top 3 reasons
                "eligibilityStatus": "check-requirements" if score < 50 else "likely-eligible"
            })

    return sorted(matches, key=lambda x: x['score'], reverse=True)[:top_n]

def analyze(resume_text, personal_statement):
    """Main analysis function with clean JSON output"""
    careers_result, skills, gpa, edu, riasec = match_careers(resume_text, personal_statement)
    
    # Calculate confidence
    confidence_score = min(len(skills) * 4, 40)
    if gpa is not None: confidence_score += 20
    if edu != "Unknown": confidence_score += 20
    if len(resume_text + personal_statement) >= 500: confidence_score += 20
    
    confidence = "high" if confidence_score >= 75 else "medium" if confidence_score >= 50 else "low"
    
    # Extract interests from career matches and RIASEC analysis
    interests = []
    riasec_labels = ["Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional"]
    
    # Add interests based on top RIASEC scores
    for i, score in enumerate(riasec):
        if score >= 1:  # Lower threshold for better interest detection
            if riasec_labels[i] == "Investigative":
                interests.extend(["Technology", "Problem Solving", "Research"])
            elif riasec_labels[i] == "Social":
                interests.extend(["Healthcare", "Education", "Helping Others"])
            elif riasec_labels[i] == "Enterprising":
                interests.extend(["Business", "Leadership", "Management"])
            elif riasec_labels[i] == "Artistic":
                interests.extend(["Creative Arts", "Design", "Innovation"])
            elif riasec_labels[i] == "Conventional":
                interests.extend(["Organization", "Data Analysis", "Finance"])
            elif riasec_labels[i] == "Realistic":
                interests.extend(["Engineering", "Construction", "Hands-on Work"])
    
    # Add interests based on skills detected
    text_lower = (resume_text + " " + personal_statement).lower()
    if any(skill in skills for skill in ["javascript", "python", "react", "sql", "data analysis"]):
        interests.extend(["Technology", "Software Development"])
    if any(skill in skills for skill in ["nursing", "patient care", "medical"]):
        interests.extend(["Healthcare", "Medical Services"])
    if any(skill in skills for skill in ["marketing", "sales", "business"]):
        interests.extend(["Business", "Marketing"])
        
    # Remove duplicates and limit
    interests = list(set(interests))[:5]
    
    # Extract demographics from text (enhanced inference)
    demographics = []
    if any(term in text_lower for term in ["first-generation", "first generation"]):
        demographics.append("First-generation")
    if any(term in text_lower for term in ["stem", "science", "technology", "engineering", "mathematics", "computer"]):
        demographics.append("STEM student")
    if any(term in text_lower for term in ["low-income", "pell grant", "financial aid", "need-based"]):
        demographics.append("Low-income")
    if any(term in text_lower for term in ["hispanic", "latino", "latina"]):
        demographics.append("Hispanic")
    if any(term in text_lower for term in ["african american", "black", "minority"]):
        demographics.append("Minority")
    if any(term in text_lower for term in ["female", "woman", "women"]):
        demographics.append("Women")
    if any(term in text_lower for term in ["women in", "female", "diversity"]):
        demographics.append("Women in STEM")
    if any(term in text_lower for term in ["minority", "underrepresented", "hispanic", "latino", "african american", "black"]):
        demographics.append("Underrepresented minority")
    
    # Match scholarships using enhanced algorithm with all parameters
    print(f"Matching scholarships with GPA: {gpa}, Demographics: {demographics}", file=sys.stderr)
    scholarships_matched = match_scholarships(gpa, interests, demographics)
    
    return {
        "interests": interests,
        "skills": skills,
        "gpa": gpa,
        "education_level": edu,
        "demographics": demographics,
        "careers": careers_result,
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
            "riasec_total": sum(riasec),
            "interests_extracted": len(interests)
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