import json
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.database import get_session
from app.models import User, Skill, AssessmentResult, UserLearningProgress
from app.auth import get_current_user

router = APIRouter()

# Target Industry Roles with required benchmark skills from the controlled catalog
CAREER_ROLES = [
    {
        "id": "full-stack",
        "title": "Full-Stack Web Developer",
        "icon": "🌐",
        "category": "Software Engineering",
        "description": "Architects responsive frontend interfaces and high-performance backend microservices.",
        "required_skills": [
            {"name": "React", "category": "Frontend", "benchmark": 75, "priority": "High"},
            {"name": "FastAPI", "category": "Backend", "benchmark": 75, "priority": "High"},
            {"name": "Python", "category": "Programming", "benchmark": 70, "priority": "Medium"},
            {"name": "SQL", "category": "Database", "benchmark": 75, "priority": "High"},
            {"name": "REST APIs", "category": "Backend", "benchmark": 80, "priority": "Critical"},
            {"name": "Git", "category": "Developer Tools", "benchmark": 70, "priority": "Medium"},
            {"name": "Docker", "category": "Developer Tools", "benchmark": 65, "priority": "Medium"},
            {"name": "HTML", "category": "Frontend", "benchmark": 80, "priority": "Medium"},
            {"name": "CSS", "category": "Frontend", "benchmark": 75, "priority": "Medium"},
        ]
    },
    {
        "id": "ai-data-scientist",
        "title": "Data Scientist & AI Engineer",
        "icon": "🤖",
        "category": "Artificial Intelligence",
        "description": "Develops predictive models, exploratory data pipelines, and Generative AI applications.",
        "required_skills": [
            {"name": "Python", "category": "Programming", "benchmark": 85, "priority": "Critical"},
            {"name": "Machine Learning", "category": "AI and Data", "benchmark": 80, "priority": "Critical"},
            {"name": "Data Analysis", "category": "AI and Data", "benchmark": 80, "priority": "High"},
            {"name": "SQL", "category": "Database", "benchmark": 75, "priority": "High"},
            {"name": "Generative AI", "category": "AI and Data", "benchmark": 75, "priority": "High"},
            {"name": "Algorithms", "category": "CS Fundamentals", "benchmark": 70, "priority": "Medium"},
        ]
    },
    {
        "id": "backend-engineer",
        "title": "Backend Systems Engineer",
        "icon": "⚙️",
        "category": "Systems & Infrastructure",
        "description": "Designs scalable server architecture, relational schema models, and high-throughput APIs.",
        "required_skills": [
            {"name": "Python", "category": "Programming", "benchmark": 80, "priority": "High"},
            {"name": "FastAPI", "category": "Backend", "benchmark": 80, "priority": "Critical"},
            {"name": "SQL", "category": "Database", "benchmark": 80, "priority": "Critical"},
            {"name": "DBMS", "category": "CS Fundamentals", "benchmark": 75, "priority": "High"},
            {"name": "REST APIs", "category": "Backend", "benchmark": 85, "priority": "Critical"},
            {"name": "Operating Systems", "category": "CS Fundamentals", "benchmark": 70, "priority": "Medium"},
            {"name": "Computer Networks", "category": "CS Fundamentals", "benchmark": 70, "priority": "Medium"},
            {"name": "Docker", "category": "Developer Tools", "benchmark": 75, "priority": "High"},
        ]
    },
    {
        "id": "devops-cloud",
        "title": "Cloud & DevOps Specialist",
        "icon": "☁️",
        "category": "Cloud & Operations",
        "description": "Manages automated CI/CD pipelines, container orchestration, and server reliability.",
        "required_skills": [
            {"name": "Docker", "category": "Developer Tools", "benchmark": 85, "priority": "Critical"},
            {"name": "Linux", "category": "Developer Tools", "benchmark": 80, "priority": "Critical"},
            {"name": "Git", "category": "Developer Tools", "benchmark": 80, "priority": "High"},
            {"name": "Python", "category": "Programming", "benchmark": 70, "priority": "Medium"},
            {"name": "REST APIs", "category": "Backend", "benchmark": 75, "priority": "Medium"},
            {"name": "Computer Networks", "category": "CS Fundamentals", "benchmark": 75, "priority": "High"},
        ]
    },
    {
        "id": "frontend-specialist",
        "title": "Frontend UI/UX Engineer",
        "icon": "🎨",
        "category": "Frontend Engineering",
        "description": "Crafts accessible, high-performance web applications and design system components.",
        "required_skills": [
            {"name": "React", "category": "Frontend", "benchmark": 85, "priority": "Critical"},
            {"name": "JavaScript", "category": "Programming", "benchmark": 85, "priority": "Critical"},
            {"name": "HTML", "category": "Frontend", "benchmark": 90, "priority": "High"},
            {"name": "CSS", "category": "Frontend", "benchmark": 85, "priority": "High"},
            {"name": "REST APIs", "category": "Backend", "benchmark": 70, "priority": "Medium"},
            {"name": "Git", "category": "Developer Tools", "benchmark": 75, "priority": "Medium"},
        ]
    }
]

# Curated practical resources and practice challenges for learning paths
SKILL_LEARNING_CONTENT: Dict[str, Dict[str, Any]] = {
    "Python": {
        "topics": ["OOP Design Patterns", "Asyncio & Concurrency", "List Comprehensions & Generators", "Unit Testing"],
        "resources": [
            {"title": "Official Python Tutorial", "url": "https://docs.python.org/3/tutorial/", "type": "Documentation"},
            {"title": "Full Speed Python Free Book", "url": "https://github.com/joaoventura/full-speed-python", "type": "Interactive Guide"}
        ],
        "project": "Build a CLI expense manager with SQLite integration and robust error handling."
    },
    "React": {
        "topics": ["Custom Hooks", "Context API & State", "Component Lifecycle & Effects", "Optimization with memo/useCallback"],
        "resources": [
            {"title": "Official React Quickstart & Guides", "url": "https://react.dev/learn", "type": "Documentation"},
            {"title": "Frontend Roadmap & Patterns", "url": "https://roadmap.sh/react", "type": "Interactive Roadmap"}
        ],
        "project": "Build an interactive Kanban board with drag-and-drop state persistence."
    },
    "FastAPI": {
        "topics": ["Pydantic v2 Validation", "Dependency Injection", "JWT Security & OAuth2", "SQLModel ORM Integration"],
        "resources": [
            {"title": "FastAPI Official Interactive Tutorial", "url": "https://fastapi.tiangolo.com/tutorial/", "type": "Documentation"},
            {"title": "Building Production APIs in Python", "url": "https://realpython.com/fastapi-python-web-apis/", "type": "Deep Dive"}
        ],
        "project": "Create a multi-tenant authentication microservice with password hashing and token expiry."
    },
    "SQL": {
        "topics": ["Complex Joins & Aggregations", "Indexing Strategies (B-Tree/Hash)", "ACID Transactions & Isolation", "Database Normalization (3NF)"],
        "resources": [
            {"title": "SQLBolt Interactive Lessons", "url": "https://sqlbolt.com/", "type": "Interactive"},
            {"title": "PostgreSQL Exercises & Challenges", "url": "https://pgexercises.com/", "type": "Practice"}
        ],
        "project": "Design and optimize a high-volume e-commerce order schema with foreign key indexes."
    },
    "Docker": {
        "topics": ["Multi-stage Dockerfile builds", "Volume mounting & Networks", "Docker Compose Orchestration", "Image Size Optimization"],
        "resources": [
            {"title": "Docker Official Getting Started", "url": "https://docs.docker.com/get-started/", "type": "Documentation"},
            {"title": "Containerization Guide for Developers", "url": "https://roadmap.sh/docker", "type": "Roadmap"}
        ],
        "project": "Containerize a full-stack React + FastAPI + PostgreSQL application using Docker Compose."
    },
    "Machine Learning": {
        "topics": ["Supervised & Unsupervised Algorithms", "Cross-Validation & Hyperparameter Tuning", "Scikit-Learn Pipelines", "Feature Scaling & Encoding"],
        "resources": [
            {"title": "Scikit-Learn Machine Learning Guide", "url": "https://scikit-learn.org/stable/tutorial/index.html", "type": "Documentation"},
            {"title": "Kaggle Micro-courses", "url": "https://www.kaggle.com/learn", "type": "Interactive Courses"}
        ],
        "project": "Train and evaluate a salary prediction model with cross-validated evaluation metrics."
    },
    "REST APIs": {
        "topics": ["Idempotency & HTTP Verbs", "Error Response Formatting (RFC 7807)", "Rate Limiting & CORS", "Pagination & Filtering"],
        "resources": [
            {"title": "REST API Design Best Practices", "url": "https://restfulapi.net/", "type": "Specification Guide"}
        ],
        "project": "Implement standard pagination, sorting, and error handling middleware for REST endpoints."
    },
    "Git": {
        "topics": ["Branching workflows (Git Flow)", "Interactive Rebasing & Cherry-pick", "Resolving Merge Conflicts", "Git Hooks & Submodules"],
        "resources": [
            {"title": "Pro Git Book (Free)", "url": "https://git-scm.com/book/en/v2", "type": "Book"}
        ],
        "project": "Set up a feature-branch workflow with protected main branch and automated pre-commit hooks."
    },
    "Data Analysis": {
        "topics": ["Pandas DataFrames & Series", "Data Cleaning & Missing Value Imputation", "Matplotlib/Seaborn Visualization", "Statistical Summaries"],
        "resources": [
            {"title": "10 Minutes to Pandas", "url": "https://pandas.pydata.org/docs/user_guide/10min.html", "type": "Documentation"}
        ],
        "project": "Analyze a real-world dataset of student placement records and output exploratory visualizations."
    },
    "Generative AI": {
        "topics": ["Prompt Engineering Techniques", "RAG (Retrieval-Augmented Generation)", "Vector Embeddings & Semantic Search", "Function Calling / Tools"],
        "resources": [
            {"title": "OpenAI & Anthropic Prompt Engineering Guides", "url": "https://platform.openai.com/docs/guides/prompt-engineering", "type": "Guide"}
        ],
        "project": "Build a Q&A document bot that performs vector search over university PDF syllabi."
    }
}


@router.get("/learning-paths/roles")
def get_career_roles():
    """
    Returns available industry career roles and required skill benchmarks.
    """
    return {"roles": CAREER_ROLES}


class AnalyzeGapRequest(BaseModel):
    user_id: Optional[int] = None
    role_id: str


@router.post("/learning-paths/analyze")
def analyze_skill_gap(
    req: AnalyzeGapRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Compares the student's actual database assessment results against target role benchmarks.
    """
    role = next((r for r in CAREER_ROLES if r["id"] == req.role_id), None)
    if not role:
        raise HTTPException(status_code=404, detail="Career role not found")

    target_user_id = current_user.id
    if current_user.role in ["admin", "academia"] and req.user_id:
        target_user_id = req.user_id

    # Fetch student's real assessment scores from SQLite
    results = session.exec(
        select(AssessmentResult).where(AssessmentResult.user_id == target_user_id)
    ).all()

    student_scores: Dict[str, int] = {}
    for r in results:
        skill = session.get(Skill, r.skill_id)
        if skill:
            student_scores[skill.name] = r.score

    total_required = len(role["required_skills"])
    total_score_earned = 0
    max_possible_benchmark = sum(s["benchmark"] for s in role["required_skills"])

    skill_breakdown = []
    proficient_count = 0
    developing_count = 0
    missing_count = 0

    for req_skill in role["required_skills"]:
        name = req_skill["name"]
        benchmark = req_skill["benchmark"]
        current_score = student_scores.get(name, 0)
        has_taken_test = name in student_scores

        gap = max(0, benchmark - current_score)
        total_score_earned += min(current_score, benchmark)

        if current_score >= benchmark:
            status = "Proficient"
            proficient_count += 1
        elif has_taken_test:
            status = "Developing"
            developing_count += 1
        else:
            status = "Unassessed"
            missing_count += 1

        skill_breakdown.append({
            "skill_name": name,
            "category": req_skill["category"],
            "priority": req_skill["priority"],
            "benchmark_score": benchmark,
            "current_score": current_score,
            "gap": gap,
            "status": status,
            "has_assessment": has_taken_test
        })

    overall_readiness = round((total_score_earned / max(1, max_possible_benchmark)) * 100)

    return {
        "role_id": role["id"],
        "role_title": role["title"],
        "overall_readiness_percentage": overall_readiness,
        "summary": {
            "total_skills": total_required,
            "proficient": proficient_count,
            "developing": developing_count,
            "unassessed": missing_count
        },
        "skill_breakdown": skill_breakdown
    }


class GenerateRoadmapRequest(BaseModel):
    user_id: Optional[int] = None
    role_id: str


@router.post("/learning-paths/generate")
def generate_personalized_roadmap(
    req: GenerateRoadmapRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Generates a personalized, structured learning roadmap prioritized by real skill gaps.
    """
    role = next((r for r in CAREER_ROLES if r["id"] == req.role_id), None)
    if not role:
        raise HTTPException(status_code=404, detail="Career role not found")

    target_user_id = current_user.id
    if current_user.role in ["admin", "academia"] and req.user_id:
        target_user_id = req.user_id

    # Fetch user results
    results = session.exec(
        select(AssessmentResult).where(AssessmentResult.user_id == target_user_id)
    ).all()
    user_scores = {session.get(Skill, r.skill_id).name: r.score for r in results if session.get(Skill, r.skill_id)}

    # Fetch saved progress
    progress_record = session.exec(
        select(UserLearningProgress).where(UserLearningProgress.user_id == target_user_id)
    ).first()
    completed_milestone_ids = json.loads(progress_record.completed_milestones) if progress_record else []

    # Sort required skills by gap size (highest gap first)
    skills_with_gap = []
    for s in role["required_skills"]:
        name = s["name"]
        score = user_scores.get(name, 0)
        gap = max(0, s["benchmark"] - score)
        skills_with_gap.append({
            "name": name,
            "gap": gap,
            "score": score,
            "benchmark": s["benchmark"],
            "category": s["category"],
            "priority": s["priority"]
        })

    # Sort: Critical/High gaps first
    skills_with_gap.sort(key=lambda x: (x["gap"] > 0, x["gap"]), reverse=True)

    milestones = []
    for idx, item in enumerate(skills_with_gap, start=1):
        skill_name = item["name"]
        content = SKILL_LEARNING_CONTENT.get(skill_name, {
            "topics": [f"{skill_name} Core Principles", f"{skill_name} Practical Applications", f"{skill_name} Problem Solving"],
            "resources": [{"title": f"{skill_name} Official Documentation", "url": "https://devdocs.io", "type": "Documentation"}],
            "project": f"Build a demonstration module applying {skill_name} best practices."
        })

        milestone_id = f"m_{req.role_id}_{skill_name.lower().replace(' ', '_').replace('.', '_')}"
        is_completed = milestone_id in completed_milestone_ids or item["score"] >= item["benchmark"]

        # Stage allocation
        if idx <= 2:
            stage = "Phase 1: High-Priority Foundations"
        elif idx <= 5:
            stage = "Phase 2: Core Engineering & Frameworks"
        else:
            stage = "Phase 3: Production Mastery & Capstone"

        milestones.append({
            "id": milestone_id,
            "step_number": idx,
            "stage": stage,
            "skill_name": skill_name,
            "category": item["category"],
            "priority": item["priority"],
            "current_score": item["score"],
            "target_score": item["benchmark"],
            "gap": item["gap"],
            "status": "Completed" if is_completed else "In Progress" if item["score"] > 0 else "Pending",
            "is_completed": is_completed,
            "topics": content["topics"],
            "resources": content["resources"],
            "hands_on_project": content["project"]
        })

    return {
        "role_id": role["id"],
        "role_title": role["title"],
        "total_milestones": len(milestones),
        "completed_count": len([m for m in milestones if m["is_completed"]]),
        "milestones": milestones
    }


class SaveProgressRequest(BaseModel):
    user_id: Optional[int] = None
    target_role: str
    milestone_id: str
    completed: bool


@router.post("/learning-paths/progress")
def save_milestone_progress(
    req: SaveProgressRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Persists student milestone checkoffs into the SQLite database.
    """
    target_user_id = current_user.id
    if current_user.role == "admin" and req.user_id:
        target_user_id = req.user_id

    record = session.exec(
        select(UserLearningProgress).where(UserLearningProgress.user_id == target_user_id)
    ).first()

    if not record:
        completed = [req.milestone_id] if req.completed else []
        record = UserLearningProgress(
            user_id=target_user_id,
            target_role=req.target_role,
            completed_milestones=json.dumps(completed),
            updated_at=datetime.utcnow()
        )
        session.add(record)
    else:
        completed = json.loads(record.completed_milestones) if record.completed_milestones else []
        if req.completed and req.milestone_id not in completed:
            completed.append(req.milestone_id)
        elif not req.completed and req.milestone_id in completed:
            completed.remove(req.milestone_id)

        record.completed_milestones = json.dumps(completed)
        record.target_role = req.target_role
        record.updated_at = datetime.utcnow()

    session.commit()
    session.refresh(record)

    return {
        "message": "Learning progress updated in database",
        "completed_milestones": json.loads(record.completed_milestones)
    }


@router.get("/learning-paths/progress/{user_id}")
def get_user_progress(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches the student's active target role and completed milestones from the database.
    """
    if current_user.role not in ["admin", "academia"] and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorized to view another student's progress."
        )

    record = session.exec(
        select(UserLearningProgress).where(UserLearningProgress.user_id == user_id)
    ).first()

    if not record:
        return {
            "user_id": user_id,
            "target_role": "full-stack",
            "completed_milestones": []
        }

    return {
        "user_id": user_id,
        "target_role": record.target_role,
        "completed_milestones": json.loads(record.completed_milestones) if record.completed_milestones else []
    }
