import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from typing import List, Dict, Any

from app.database import get_session
from app.models import (
    User,
    StudentProfile,
    IndustryProfile,
    AcademiaProfile,
    AdminProfile,
    Skill,
    AssessmentResult,
    Internship,
    Application
)
from app.auth import get_current_user, require_roles

router = APIRouter()


@router.get("/admin/stats")
def get_admin_stats(
    session: Session = Depends(get_session)
):
    """
    Returns platform health and record counts queried directly from the SQLite database.
    """
    total_students = len(session.exec(select(User).where(User.role == "student")).all())
    total_industry = len(session.exec(select(User).where(User.role == "industry")).all())
    total_academia = len(session.exec(select(User).where(User.role == "academia")).all())
    total_assessments = len(session.exec(select(AssessmentResult)).all())
    total_jobs = len(session.exec(select(Internship).where(Internship.is_active == True)).all())
    total_skills = len(session.exec(select(Skill)).all())

    # Count profile records in dedicated tables
    student_profile_count = len(session.exec(select(StudentProfile)).all())
    industry_profile_count = len(session.exec(select(IndustryProfile)).all())
    academia_profile_count = len(session.exec(select(AcademiaProfile)).all())
    admin_profile_count = len(session.exec(select(AdminProfile)).all())

    return {
        "students_count": total_students,
        "industry_count": total_industry,
        "academia_count": total_academia,
        "assessments_count": total_assessments,
        "jobs_count": total_jobs,
        "skills_count": total_skills,
        "student_profiles_count": student_profile_count,
        "industry_profiles_count": industry_profile_count,
        "academia_profiles_count": academia_profile_count,
        "admin_profiles_count": admin_profile_count,
        "status": "healthy"
    }


@router.get("/industry/candidates")
def get_verified_candidates(
    session: Session = Depends(get_session)
):
    """
    Returns registered students with verified assessment scores.
    """
    students = session.exec(select(User).where(User.role == "student")).all()
    candidates = []

    for s in students:
        # Fetch dedicated student profile from student_profiles table
        student_prof = session.exec(
            select(StudentProfile).where(StudentProfile.user_id == s.id)
        ).first()

        # Fetch actual assessment results for this student
        results = session.exec(
            select(AssessmentResult).where(AssessmentResult.user_id == s.id)
        ).all()
        
        user_skills = []
        total_score = 0
        user_skills = []
        total_score = 0
        total_integrity = 0
        total_violations = 0
        is_flagged = False

        for r in results:
            skill = session.get(Skill, r.skill_id)
            skill_name = skill.name if skill else f"Skill #{r.skill_id}"
            integ = getattr(r, "integrity_score", 100)
            viol = getattr(r, "violations_count", 0)
            status = getattr(r, "proctoring_status", "Clear")

            if status in ["Suspicious", "Flagged"] or integ < 70:
                is_flagged = True

            user_skills.append({
                "skill_name": skill_name,
                "score": r.score,
                "questions_answered": r.questions_answered,
                "integrity_score": integ,
                "violations_count": viol,
                "proctoring_status": status
            })
            total_score += r.score
            total_integrity += integ
            total_violations += viol

        avg_score = round(total_score / len(results)) if results else 0
        avg_integrity = round(total_integrity / len(results)) if results else 100

        college = student_prof.college if student_prof and student_prof.college else (s.college or "University Partner")
        branch = student_prof.branch if student_prof and student_prof.branch else (s.branch or "Computer Science")
        year = student_prof.year if student_prof and student_prof.year else (s.year or 3)
        cgpa = student_prof.cgpa if student_prof and student_prof.cgpa else (s.cgpa or 8.0)

        candidates.append({
            "id": s.id,
            "full_name": s.full_name or s.email.split("@")[0],
            "email": s.email,
            "college": college,
            "branch": branch,
            "year": year,
            "cgpa": cgpa,
            "bio": student_prof.bio if student_prof else None,
            "github_url": student_prof.github_url if student_prof else None,
            "verified_skills": user_skills,
            "assessments_count": len(results),
            "average_score": avg_score,
            "integrity_score": avg_integrity,
            "total_violations": total_violations,
            "proctoring_status": "Flagged" if is_flagged else "Verified Clear" if avg_integrity >= 85 else "Reviewed",
            "readiness": "High" if avg_score >= 75 else "Moderate" if avg_score >= 50 else "Developing"
        })

    return {
        "count": len(candidates),
        "candidates": candidates
    }


@router.get("/academia/analytics")
def get_academia_analytics(
    session: Session = Depends(get_session)
):
    """
    Computes institutional cohort statistics and skill gaps by cross-referencing
    actual student assessment scores with actual skills demanded in job postings.
    """
    students = session.exec(select(User).where(User.role == "student")).all()
    results = session.exec(select(AssessmentResult)).all()
    jobs = session.exec(select(Internship).where(Internship.is_active == True)).all()
    skills = session.exec(select(Skill)).all()

    # Calculate student score averages per skill
    skill_scores: Dict[str, List[int]] = {}
    for r in results:
        skill = session.get(Skill, r.skill_id)
        if skill:
            skill_scores.setdefault(skill.name, []).append(r.score)

    # Calculate industry demand frequency per skill from internships table
    industry_demand_counts: Dict[str, int] = {}
    for j in jobs:
        try:
            reqs = json.loads(j.required_skills) if j.required_skills else []
            for req in reqs:
                req_clean = req.strip()
                industry_demand_counts[req_clean] = industry_demand_counts.get(req_clean, 0) + 1
        except Exception:
            pass

    max_job_count = max(len(jobs), 1)

    skill_gap_analysis = []
    for s in skills:
        avg_student_score = round(sum(skill_scores[s.name]) / len(skill_scores[s.name])) if s.name in skill_scores else 0
        demand_freq = industry_demand_counts.get(s.name, 0)
        demand_percentage = min(100, round((demand_freq / max_job_count) * 100)) if demand_freq > 0 else 20

        skill_gap_analysis.append({
            "skill_name": s.name,
            "category": s.category,
            "cohort_average_score": avg_student_score,
            "industry_demand_percentage": demand_percentage,
            "gap": max(0, demand_percentage - avg_student_score),
            "students_tested": len(skill_scores.get(s.name, []))
        })

    # Overall cohort readiness
    total_scores = [r.score for r in results]
    cohort_avg = round(sum(total_scores) / len(total_scores)) if total_scores else 0

    return {
        "total_enrolled_students": len(students),
        "total_assessments_taken": len(results),
        "cohort_average_score": cohort_avg,
        "readiness_rate": f"{round((len([s for s in total_scores if s >= 70]) / max(1, len(total_scores))) * 100, 1)}%",
        "skill_gap_analysis": skill_gap_analysis
    }
