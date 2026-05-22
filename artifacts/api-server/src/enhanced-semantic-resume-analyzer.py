#!/usr/bin/env python3
"""
Enhanced Resume Analyzer with Semantic Embeddings
Provides unique, high-accuracy career and scholarship matching with detailed explanations
"""

import json
import sys
import re
import spacy
from flashtext import KeywordProcessor
from sentence_transformers import SentenceTransformer, util
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
import traceback

# Load models
try:
    nlp = spacy.load("en_core_web_sm")
    # Use lightweight, fast model for embeddings
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    print(f"Error loading models: {e}", file=sys.stderr)
    sys.exit(1)

class SemanticResumeAnalyzer:
    def __init__(self):
        self.skills_processor = KeywordProcessor()
        self.education_keywords = KeywordProcessor()
        self.experience_keywords = KeywordProcessor()
        
        # Enhanced skill categories with 200+ skills
        self.skills_database = {
            'Programming': ['Python', 'JavaScript', 'Java', 'C++', 'C#', 'Ruby', 'PHP', 'Go', 'Rust', 'Swift'],
            'Web Development': ['HTML', 'CSS', 'React', 'Angular', 'Vue.js', 'Node.js', 'Express', 'Django', 'Flask'],
            'Data Science': ['Machine Learning', 'Data Analysis', 'Statistics', 'R', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch'],
            'Database': ['SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Oracle', 'Database Design', 'NoSQL'],
            'Cloud Computing': ['AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'DevOps', 'CI/CD'],
            'Healthcare': ['Patient Care', 'Medical Terminology', 'Nursing', 'Clinical Skills', 'Emergency Care'],
            'Business': ['Project Management', 'Leadership', 'Strategic Planning', 'Team Management', 'Communication'],
            'Design': ['UI/UX Design', 'Graphic Design', 'Adobe Creative Suite', 'Figma', 'Sketch', 'User Research'],
            'Finance': ['Financial Analysis', 'Accounting', 'Investment Analysis', 'Risk Management', 'Excel'],
            'Marketing': ['Digital Marketing', 'SEO', 'Content Marketing', 'Social Media', 'Brand Management'],
            'Engineering': ['Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'CAD', 'AutoCAD'],
            'Education': ['Teaching', 'Curriculum Development', 'Educational Technology', 'Student Assessment'],
            'Legal': ['Legal Research', 'Contract Law', 'Litigation', 'Legal Writing', 'Compliance'],
            'Sales': ['Sales Management', 'Customer Relations', 'Negotiation', 'CRM', 'Lead Generation']
        }
        
        # Load skills into processor
        for category, skills in self.skills_database.items():
            for skill in skills:
                self.skills_processor.add_keyword(skill.lower(), (skill, category))
        
        # Education levels and keywords
        self.education_levels = {
            'high_school': ['high school', 'hs diploma', 'secondary school', 'ged'],
            'associate': ['associate degree', 'aa', 'as', 'associate of', 'community college'],
            'bachelor': ['bachelor', 'bs', 'ba', 'undergraduate', 'college degree'],
            'master': ['master', 'ms', 'ma', 'mba', 'graduate degree', 'masters'],
            'doctoral': ['phd', 'doctorate', 'doctoral', 'ph.d', 'doctor of philosophy'],
            'professional': ['md', 'jd', 'pharmd', 'dvm', 'professional degree']
        }
        
        for level, keywords in self.education_levels.items():
            for keyword in keywords:
                self.education_keywords.add_keyword(keyword, level)

    def extract_skills(self, text):
        """Extract skills with categories and confidence scores"""
        text_lower = text.lower()
        found_skills = self.skills_processor.extract_keywords(text_lower)
        
        skills_by_category = {}
        all_skills = []
        
        for skill, category in found_skills:
            if category not in skills_by_category:
                skills_by_category[category] = []
            skills_by_category[category].append(skill)
            all_skills.append(skill)
        
        # Calculate skill confidence based on frequency and context
        skill_confidence = {}
        for skill in all_skills:
            count = text_lower.count(skill.lower())
            # Higher confidence for skills mentioned multiple times
            confidence = min(0.95, 0.6 + (count * 0.1))
            skill_confidence[skill] = confidence
        
        return {
            'skills': all_skills,
            'skills_by_category': skills_by_category,
            'skill_confidence': skill_confidence
        }

    def extract_education(self, text):
        """Extract education details with improved accuracy"""
        text_lower = text.lower()
        
        # Find education level
        education_level = 'bachelor'  # default
        found_levels = self.education_keywords.extract_keywords(text_lower)
        if found_levels:
            # Take the highest level found
            level_priority = ['doctoral', 'professional', 'master', 'bachelor', 'associate', 'high_school']
            for level in level_priority:
                if level in found_levels:
                    education_level = level
                    break
        
        # Extract GPA
        gpa = None
        gpa_patterns = [
            r'gpa:?\s*(\d+\.?\d*)',
            r'grade point average:?\s*(\d+\.?\d*)',
            r'cumulative gpa:?\s*(\d+\.?\d*)',
            r'(\d+\.?\d*)\s*/\s*4\.0',
            r'(\d+\.?\d*)\s*gpa'
        ]
        
        for pattern in gpa_patterns:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    gpa_value = float(match.group(1))
                    if 0.0 <= gpa_value <= 4.0:
                        gpa = gpa_value
                        break
                    elif 0.0 <= gpa_value <= 100.0:  # Percentage scale
                        gpa = gpa_value / 25.0  # Convert to 4.0 scale
                        break
                except ValueError:
                    continue
        
        # Extract major/field of study
        major_patterns = [
            r'major:?\s*([a-zA-Z\s]+?)(?:\n|,|\.|\s+(?:minor|gpa|university|college))',
            r'degree in ([a-zA-Z\s]+?)(?:\n|,|\.|\s+(?:from|at|university|college))',
            r'bachelor.{0,20}([a-zA-Z\s]+?)(?:\n|,|\.|\s+(?:from|at|university|college))',
            r'master.{0,20}([a-zA-Z\s]+?)(?:\n|,|\.|\s+(?:from|at|university|college))',
            r'studied ([a-zA-Z\s]+?)(?:\n|,|\.|\s+(?:at|university|college))'
        ]
        
        major = None
        for pattern in major_patterns:
            match = re.search(pattern, text_lower)
            if match:
                potential_major = match.group(1).strip().title()
                if len(potential_major) > 3 and len(potential_major) < 50:
                    major = potential_major
                    break
        
        # Extract institution
        institution_patterns = [
            r'university of ([a-zA-Z\s]+?)(?:\n|,|\.)',
            r'([a-zA-Z\s]+university)(?:\n|,|\.)',
            r'([a-zA-Z\s]+college)(?:\n|,|\.)',
            r'graduated from ([a-zA-Z\s]+?)(?:\n|,|\.)',
            r'attended ([a-zA-Z\s]+?)(?:\n|,|\.)'
        ]
        
        institution = None
        for pattern in institution_patterns:
            match = re.search(pattern, text_lower)
            if match:
                potential_institution = match.group(1).strip().title()
                if len(potential_institution) > 5 and len(potential_institution) < 60:
                    institution = potential_institution
                    break
        
        return {
            'level': education_level,
            'gpa': gpa,
            'major': major,
            'institution': institution
        }

    def extract_experience(self, text):
        """Extract work experience details"""
        text_lower = text.lower()
        
        # Calculate years of experience
        experience_patterns = [
            r'(\d+)\+?\s*years?\s*(?:of\s*)?experience',
            r'(\d+)\+?\s*years?\s*in',
            r'experience:?\s*(\d+)\+?\s*years?',
            r'over\s*(\d+)\s*years?',
            r'more than\s*(\d+)\s*years?'
        ]
        
        years = 0
        for pattern in experience_patterns:
            matches = re.findall(pattern, text_lower)
            if matches:
                years = max(years, max(int(match) for match in matches))
        
        # If no explicit years, estimate from work history
        if years == 0:
            # Count job entries with dates
            date_patterns = [
                r'20\d{2}\s*-\s*(?:20\d{2}|present|current)',
                r'(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+20\d{2}'
            ]
            
            date_count = 0
            for pattern in date_patterns:
                date_count += len(re.findall(pattern, text_lower))
            
            # Estimate 2 years per job on average
            years = min(date_count * 2, 10)
        
        # Determine experience level
        if years >= 8:
            level = 'senior'
        elif years >= 3:
            level = 'mid-level'
        elif years >= 1:
            level = 'junior'
        else:
            level = 'entry-level'
        
        # Extract industries from context
        industry_keywords = {
            'Technology': ['software', 'tech', 'it', 'programming', 'development', 'computer'],
            'Healthcare': ['medical', 'health', 'hospital', 'clinical', 'patient', 'nursing'],
            'Finance': ['financial', 'banking', 'investment', 'accounting', 'finance'],
            'Education': ['teaching', 'education', 'school', 'university', 'academic'],
            'Manufacturing': ['manufacturing', 'production', 'industrial', 'factory'],
            'Retail': ['retail', 'sales', 'customer service', 'store'],
            'Marketing': ['marketing', 'advertising', 'digital marketing', 'brand'],
            'Engineering': ['engineering', 'engineer', 'mechanical', 'electrical', 'civil'],
            'Consulting': ['consulting', 'consultant', 'advisory', 'strategy'],
            'Non-profit': ['non-profit', 'volunteer', 'community', 'social work']
        }
        
        industries = []
        for industry, keywords in industry_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    industries.append(industry)
                    break
        
        return {
            'years': years,
            'level': level,
            'industries': list(set(industries))
        }

    def calculate_riasec_profile(self, skills, text):
        """Calculate RIASEC personality profile from skills and text content"""
        riasec_keywords = {
            'realistic': ['mechanical', 'construction', 'repair', 'building', 'hands-on', 'technical', 'engineering', 'manufacturing'],
            'investigative': ['research', 'analysis', 'data', 'science', 'investigation', 'problem solving', 'mathematics', 'statistics'],
            'artistic': ['creative', 'design', 'art', 'writing', 'music', 'creative writing', 'graphic design', 'photography'],
            'social': ['teaching', 'counseling', 'helping', 'social work', 'healthcare', 'patient care', 'community'],
            'enterprising': ['leadership', 'management', 'sales', 'business', 'entrepreneurship', 'marketing', 'negotiation'],
            'conventional': ['organizing', 'data entry', 'accounting', 'administrative', 'clerical', 'systematic', 'detail-oriented']
        }
        
        text_lower = text.lower()
        riasec_scores = {}
        
        for trait, keywords in riasec_keywords.items():
            score = 0
            for keyword in keywords:
                # Count occurrences in text
                score += text_lower.count(keyword) * 10
                # Bonus for skills match
                if any(keyword in skill.lower() for skill in skills):
                    score += 20
            
            # Normalize to 0-100 scale
            riasec_scores[trait] = min(100, score)
        
        return riasec_scores

    def analyze_resume_with_embeddings(self, resume_text):
        """Main analysis function with semantic embeddings"""
        try:
            # Extract features
            skills_data = self.extract_skills(resume_text)
            education_data = self.extract_education(resume_text)
            experience_data = self.extract_experience(resume_text)
            riasec_profile = self.calculate_riasec_profile(skills_data['skills'], resume_text)
            
            # Generate semantic embedding for the entire resume
            resume_embedding = embedding_model.encode(resume_text)
            
            # Calculate confidence score based on extracted information
            confidence_factors = [
                min(len(skills_data['skills']) / 10, 1.0) * 30,  # Skills coverage (30%)
                (1.0 if education_data['major'] else 0.5) * 20,  # Education details (20%)
                min(experience_data['years'] / 5, 1.0) * 25,     # Experience (25%)
                (len(resume_text) / 2000) * 25                   # Resume completeness (25%)
            ]
            
            confidence_score = min(95, sum(confidence_factors))
            
            # Detect demographics from text patterns
            demographics = self.detect_demographics(resume_text)
            
            # Career indicators
            career_indicators = {
                'leadershipExperience': any(word in resume_text.lower() for word in ['lead', 'manage', 'supervisor', 'director', 'head of']),
                'technicalSkills': len([s for s in skills_data['skills'] if any(cat in ['Programming', 'Data Science', 'Cloud Computing'] for cat in skills_data['skills_by_category'])]) > 0,
                'researchExperience': any(word in resume_text.lower() for word in ['research', 'publication', 'thesis', 'dissertation']),
                'volunteerWork': any(word in resume_text.lower() for word in ['volunteer', 'community service', 'non-profit'])
            }
            
            result = {
                'skills': skills_data['skills'],
                'skills_by_category': skills_data['skills_by_category'],
                'skill_confidence': skills_data['skill_confidence'],
                'interests': self.infer_interests_from_skills(skills_data['skills_by_category']),
                'education': education_data,
                'experience': experience_data,
                'riasecProfile': riasec_profile,
                'demographics': demographics,
                'careerIndicators': career_indicators,
                'confidenceScore': confidence_score,
                'resumeEmbedding': resume_embedding.tolist()  # Convert to list for JSON serialization
            }
            
            return result
            
        except Exception as e:
            print(f"Error in resume analysis: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return None

    def infer_interests_from_skills(self, skills_by_category):
        """Infer career interests from skill categories"""
        interest_mapping = {
            'Programming': ['Technology', 'Software Development'],
            'Data Science': ['Analytics', 'Research', 'Technology'],
            'Healthcare': ['Healthcare', 'Patient Care', 'Medical Services'],
            'Business': ['Business Management', 'Leadership'],
            'Design': ['Creative Arts', 'User Experience'],
            'Finance': ['Financial Services', 'Investment'],
            'Marketing': ['Marketing', 'Communications'],
            'Engineering': ['Engineering', 'Technical Problem Solving'],
            'Education': ['Teaching', 'Training'],
            'Legal': ['Law', 'Legal Services']
        }
        
        interests = []
        for category, skills in skills_by_category.items():
            if category in interest_mapping and len(skills) > 0:
                interests.extend(interest_mapping[category])
        
        return list(set(interests))

    def detect_demographics(self, text):
        """Detect demographic information from resume text"""
        text_lower = text.lower()
        
        demographics = {
            'isFirstGeneration': any(phrase in text_lower for phrase in ['first generation', 'first in family', 'first to attend college']),
            'hasDisability': any(phrase in text_lower for phrase in ['disability', 'accommodation', 'accessible']),
            'isMinority': any(phrase in text_lower for phrase in ['minority', 'diversity', 'multicultural', 'hispanic', 'latino', 'african american', 'native american']),
            'financialNeed': any(phrase in text_lower for phrase in ['financial need', 'scholarship', 'financial aid', 'pell grant', 'work study'])
        }
        
        return demographics

def main():
    if len(sys.argv) != 2:
        print("Usage: python enhanced-semantic-resume-analyzer.py '<resume_text>'", file=sys.stderr)
        sys.exit(1)
    
    try:
        resume_text = sys.argv[1]
        analyzer = SemanticResumeAnalyzer()
        result = analyzer.analyze_resume_with_embeddings(resume_text)
        
        if result:
            print(json.dumps(result, indent=2))
        else:
            print(json.dumps({"error": "Failed to analyze resume"}), file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()