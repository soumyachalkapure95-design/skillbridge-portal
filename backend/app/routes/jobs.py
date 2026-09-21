from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.database import get_session
from app.models import Internship, User
from app.auth import get_current_user, require_roles
from app.services.jobs_api import fetch_all_jobs, fetch_github_jobs, fetch_jsearch_jobs

router = APIRouter()

class CreateInternshipRequest(BaseModel):
    title: str = Field(..., min_length=3)
    company_name: Optional[str] = None
    description: str = Field(..., min_length=10)
    required_skills: str = Field(default="[]")
    stipend: int = Field(default=0)
    location: str = Field(default="Remote")
    type: str = Field(default="internship")
    external_url: Optional[str] = None


@router.post("/internships", status_code=status.HTTP_201_CREATED, tags=["Jobs & Internships"])
def create_internship(
    req: CreateInternshipRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["industry", "admin"]))
):
    """
    Creates a new internship or job challenge.
    Restricted to authenticated Industry recruiters and Administrators.
    """
    comp_name = req.company_name or current_user.company or (current_user.full_name + " Labs") or "Enterprise Partner"
    
    internship = Internship(
        company_id=current_user.id,
        title=req.title,
        company_name=comp_name,
        description=req.description,
        required_skills=req.required_skills,
        stipend=req.stipend,
        location=req.location,
        type=req.type,
        source="manual",
        external_url=req.external_url,
        is_active=True,
        created_at=datetime.utcnow()
    )

    session.add(internship)
    session.commit()
    session.refresh(internship)

    return {
        "message": "Internship/Challenge posted successfully",
        "internship_id": internship.id
    }


@router.get("/jobs/fetch")
def fetch_jobs_endpoint(
    current_user: User = Depends(require_roles(["admin", "industry"]))
):
    """
    Fetch real-time jobs from all sources. Restricted to Admin/Industry.
    """
    try:
        result = fetch_all_jobs()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/fetch/remotive")
def fetch_github_jobs_endpoint(
    current_user: User = Depends(require_roles(["admin", "industry"]))
):
    """
    Fetch jobs only from Remotive API. Restricted to Admin/Industry.
    """
    try:
        jobs = fetch_github_jobs(location="India", keyword="intern")
        return {
            "source": "remotive",
            "count": len(jobs),
            "jobs": jobs,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/jobs/fetch/jsearch")
def fetch_jsearch_jobs_endpoint(
    keyword: str = "software engineer intern",
    location: str = "Bangalore",
    current_user: User = Depends(require_roles(["admin", "industry"]))
):
    """
    Fetch jobs only from JSearch API. Restricted to Admin/Industry.
    """
    try:
        jobs = fetch_jsearch_jobs(keyword=keyword, location=location)
        return {
            "source": "jsearch",
            "count": len(jobs),
            "jobs": jobs,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/internships")
def get_internships(
    source: str = None,
    location: str = None,
    limit: int = 50,
    session: Session = Depends(get_session)
):
    """
    Get all active internships from database.
    Filter by source (github/jsearch/manual) and location.
    """
    query = select(Internship).where(Internship.is_active == True)
    
    if source:
        query = query.where(Internship.source == source)
    
    if location:
        query = query.where(Internship.location.ilike(f"%{location}%"))
    
    query = query.order_by(Internship.created_at.desc()).limit(limit)
    
    internships = session.exec(query).all()
    
    formatted = []
    for internship in internships:
        formatted.append({
            "id": internship.id,
            "title": internship.title,
            "company": internship.company_name,
            "location": internship.location,
            "description": internship.description[:200],
            "stipend": internship.stipend,
            "type": internship.type,
            "source": internship.source,
            "is_live": internship.source in ["github", "jsearch", "remotive", "arbeitnow", "jobicy", "live-aggregators", "multi-source"],
            "external_url": internship.external_url,
            "posted_at": internship.created_at.isoformat() if internship.created_at else None,
            "required_skills": internship.required_skills
        })
    
    return {
        "count": len(formatted),
        "internships": formatted
    }


@router.get("/internships/{internship_id}")
def get_internship_details(
    internship_id: int,
    session: Session = Depends(get_session)
):
    """
    Get detailed information about a specific internship.
    """
    internship = session.get(Internship, internship_id)
    
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    return {
        "id": internship.id,
        "title": internship.title,
        "company": internship.company_name,
        "location": internship.location,
        "description": internship.description,
        "stipend": internship.stipend,
        "type": internship.type,
        "source": internship.source,
        "is_live": internship.source in ["github", "jsearch", "remotive"],
        "external_url": internship.external_url,
        "required_skills": internship.required_skills,
        "posted_at": internship.created_at.isoformat() if internship.created_at else None
    }


# --- GitHub Job Matching & Repository Analysis Models ---

class GitHubAnalyzeRequest(BaseModel):
    username: str = Field(..., description="GitHub handle or full profile URL")

class GitHubMatchRequest(BaseModel):
    username: Optional[str] = Field(default=None, description="GitHub username (defaults to user's registered profile)")
    user_id: Optional[int] = Field(default=None, description="Logged in user ID for pulling assessment scores")


@router.post("/github/analyze", tags=["GitHub Analysis"])
async def analyze_github_profile(
    req: GitHubAnalyzeRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Analyzes a GitHub username to extract languages, repositories, and technical skill evidence.
    """
    from app.services.github_service import fetch_github_profile_and_repos
    try:
        profile_data = await fetch_github_profile_and_repos(req.username)
        return profile_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/jobs/github-match", tags=["Jobs & Internships"])
async def match_jobs_with_github(
    req: GitHubMatchRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Computes intelligent multi-factor match percentages for all active internships/jobs:
    Match = (GitHub Code Evidence * 0.40) + (Proctored Exam Score * 0.40) + (Job Keyword Overlap * 0.20)
    """
    import json
    from app.services.github_service import fetch_github_profile_and_repos, normalize_skill
    from app.models import AssessmentResult, Skill, StudentProfile

    # 1. Determine effective GitHub username
    target_username = req.username
    effective_user_id = req.user_id or current_user.id

    if not target_username:
        # Check student profile
        stud_prof = session.exec(select(StudentProfile).where(StudentProfile.user_id == effective_user_id)).first()
        if stud_prof and stud_prof.github_url:
            target_username = stud_prof.github_url
        else:
            target_username = current_user.full_name.lower().replace(" ", "") if current_user.full_name else "student-dev"

    # 2. Fetch GitHub analysis
    try:
        github_profile = await fetch_github_profile_and_repos(target_username)
    except Exception:
        github_profile = {
            "username": target_username,
            "detected_skills": {},
            "languages": [],
            "top_repositories": [],
            "public_repos": 0
        }

    detected_github_skills = github_profile.get("detected_skills", {})

    # 3. Fetch Student's Verified Assessment Scores from SQLite DB
    user_assessments = session.exec(
        select(AssessmentResult).where(AssessmentResult.user_id == effective_user_id)
    ).all()

    verified_assessment_scores: Dict[str, int] = {}
    for a in user_assessments:
        sk = session.get(Skill, a.skill_id)
        if sk:
            verified_assessment_scores[sk.name.lower()] = a.score

    # 4. Fetch All Active Internships / Jobs
    all_jobs = session.exec(select(Internship).where(Internship.is_active == True)).all()

    matched_jobs_list = []

    for job in all_jobs:
        # Parse job required skills
        req_skills_list = []
        if job.required_skills:
            try:
                parsed = json.loads(job.required_skills)
                if isinstance(parsed, list):
                    for item in parsed:
                        if isinstance(item, str):
                            req_skills_list.append(item.strip())
                        elif isinstance(item, dict) and "name" in item:
                            req_skills_list.append(item["name"].strip())
            except Exception:
                req_skills_list = [s.strip() for s in job.required_skills.split(",") if s.strip()]

        if not req_skills_list:
            # Infer from title / description
            text_corpus = f"{job.title} {job.description}".lower()
            for cand_skill in ["Python", "FastAPI", "React", "JavaScript", "SQL", "Java", "Docker", "Node.js", "C++", "MongoDB", "Data Structures", "Machine Learning"]:
                if cand_skill.lower() in text_corpus:
                    req_skills_list.append(cand_skill)

        # Multi-Factor Matching Analysis per Job
        matched_skills_meta = []
        missing_skills = []
        github_evidence_repos = []

        total_req_count = len(req_skills_list) or 1
        github_evidence_score = 0.0
        assessment_score_accum = 0.0
        keyword_overlap_score = 0.0

        for skill_req in req_skills_list:
            norm_skill = normalize_skill(skill_req) or skill_req
            s_lower = norm_skill.lower()
            has_github_match = False
            has_exam_match = False
            sources = []

            # Check GitHub match
            if norm_skill in detected_github_skills:
                has_github_match = True
                gh_info = detected_github_skills[norm_skill]
                sources.append("GitHub Repo")
                github_evidence_score += 100.0
                for r_name in gh_info.get("repos", []):
                    if r_name not in github_evidence_repos:
                        github_evidence_repos.append(r_name)
            else:
                # Check fuzzy match in languages
                for lang_item in github_profile.get("languages", []):
                    if lang_item.get("language", "").lower() == s_lower:
                        has_github_match = True
                        sources.append("GitHub Language")
                        github_evidence_score += 85.0
                        break

            # Check Proctored Assessment match
            if s_lower in verified_assessment_scores:
                has_exam_match = True
                exam_score = verified_assessment_scores[s_lower]
                sources.append(f"Proctored Exam ({exam_score}%)")
                assessment_score_accum += exam_score

            if has_github_match or has_exam_match:
                matched_skills_meta.append({
                    "skill_name": norm_skill,
                    "sources": sources,
                    "is_verified": has_exam_match
                })
            else:
                missing_skills.append(norm_skill)

        # Baseline text overlap
        job_title_lower = job.title.lower()
        for s in matched_skills_meta:
            if s["skill_name"].lower() in job_title_lower:
                keyword_overlap_score += 100.0

        # Weighted calculation
        avg_gh_score = github_evidence_score / total_req_count
        avg_exam_score = assessment_score_accum / total_req_count
        avg_keyword_score = min(100.0, keyword_overlap_score / total_req_count)

        # Blend scores: If student has both GitHub and exam, 40/40/20. If only GitHub, 70/30. If only exam, 70/30.
        if github_profile.get("public_repos", 0) > 0 and verified_assessment_scores:
            final_match_pct = round((avg_gh_score * 0.40) + (avg_exam_score * 0.40) + (avg_keyword_score * 0.20))
        elif github_profile.get("public_repos", 0) > 0:
            final_match_pct = round((avg_gh_score * 0.70) + (avg_keyword_score * 0.30))
        elif verified_assessment_scores:
            final_match_pct = round((avg_exam_score * 0.70) + (avg_keyword_score * 0.30))
        else:
            final_match_pct = 50  # Default base match for exploring

        final_match_pct = max(15, min(98, final_match_pct))

        # Tailor actionable learning recommendations
        recommendation = None
        if missing_skills:
            top_missing = missing_skills[0]
            recommendation = f"Build a {top_missing} project or take the {top_missing} assessment to boost match by +{round(100/total_req_count)}%."
        elif final_match_pct >= 85:
            recommendation = "⭐ Top Tier Match! Your GitHub repos and verified scores align strongly with this role."
        else:
            recommendation = "Great alignment! Taking an assessment can verify your skills for recruiters."

        matched_jobs_list.append({
            "id": job.id,
            "title": job.title,
            "company": job.company_name,
            "location": job.location,
            "description": job.description,
            "stipend": job.stipend,
            "type": job.type,
            "source": job.source,
            "is_live": job.source in ["github", "jsearch", "remotive"],
            "external_url": job.external_url,
            "posted_at": job.created_at.isoformat() if job.created_at else None,
            "required_skills": req_skills_list,
            "match_score": final_match_pct,
            "matched_skills": matched_skills_meta,
            "missing_skills": missing_skills,
            "github_evidence_repos": github_evidence_repos[:3],
            "learning_recommendation": recommendation
        })

    # Sort by match score descending
    matched_jobs_list.sort(key=lambda j: j["match_score"], reverse=True)

    return {
        "github_profile": {
            "username": github_profile.get("username"),
            "name": github_profile.get("name"),
            "avatar_url": github_profile.get("avatar_url"),
            "public_repos": github_profile.get("public_repos", 0),
            "total_stars": github_profile.get("total_stars", 0),
            "languages": github_profile.get("languages", []),
            "top_repositories": github_profile.get("top_repositories", [])
        },
        "total_jobs_matched": len(matched_jobs_list),
        "jobs": matched_jobs_list
    }