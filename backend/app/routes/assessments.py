from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel, Field
from typing import List, Optional
import random

from app.database import get_session
from app.models import Skill, AssessmentQuestion, AssessmentResult, User
from app.auth import get_current_user, require_roles

router = APIRouter()

# --- Request/Response Models ---

class CreateQuestionRequest(BaseModel):
    skill_name: str = Field(..., description="Exact skill name from controlled catalog")
    question_text: str = Field(..., min_length=10)
    reference_answer: str = Field(..., min_length=10)
    rubric: str = Field(..., min_length=10)
    difficulty: str = Field(default="Medium", description="Easy, Medium, Hard")
    question_type: str = Field(default="Short Answer", description="Short Answer, MCQ, Coding")

class CreateQuestionResponse(BaseModel):
    message: str
    question_id: int

class QuestionResponse(BaseModel):
    id: int
    skill_name: str
    question_text: str
    reference_answer: str
    rubric: str
    difficulty: str
    question_type: str

class QuestionListResponse(BaseModel):
    count: int
    questions: List[QuestionResponse]

class PublicQuestionResponse(BaseModel):
    id: int
    skill_name: str
    question_text: str
    difficulty: str
    question_type: str

class QuestionsForCandidateResponse(BaseModel):
    skill_name: str
    num_requested: int
    num_returned: int
    questions: List[PublicQuestionResponse]

class SaveAssessmentRequest(BaseModel):
    user_id: Optional[int] = Field(default=None, description="Optional override for admin; defaults to logged in user")
    skill_id: int = Field(..., description="Skill ID being assessed")
    score: int = Field(..., ge=0, le=100, description="Assessment score 0-100")
    questions_answered: int = Field(default=0, description="Number of questions answered")
    integrity_score: Optional[int] = Field(default=100, ge=0, le=100)
    violations_count: Optional[int] = Field(default=0)
    violation_logs: Optional[str] = Field(default="[]")
    proctoring_status: Optional[str] = Field(default="Clear")

class SaveAssessmentResponse(BaseModel):
    message: str
    score: int
    user_id: int
    integrity_score: int
    proctoring_status: str


# --- Endpoints ---

@router.post("/assessments/questions", response_model=CreateQuestionResponse, tags=["Assessment Questions"])
def create_question(
    req: CreateQuestionRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["admin", "academia"]))
):
    skill = db.exec(select(Skill).where(Skill.name == req.skill_name)).first()
    if not skill:
        raise HTTPException(status_code=400, detail=f"Skill '{req.skill_name}' not found in controlled catalog")

    question = AssessmentQuestion(
        skill_id=skill.id,
        question_text=req.question_text,
        reference_answer=req.reference_answer,
        rubric=req.rubric,
        difficulty=req.difficulty,
        question_type=req.question_type
    )

    db.add(question)
    db.commit()
    db.refresh(question)

    return CreateQuestionResponse(
        message="Assessment question created successfully",
        question_id=question.id
    )


@router.get("/assessments/questions", response_model=QuestionListResponse, tags=["Assessment Questions"])
def list_questions(
    skill_name: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(require_roles(["admin", "academia"]))
):
    query = select(AssessmentQuestion).join(Skill)
    if skill_name:
        query = query.where(Skill.name == skill_name)

    questions = db.exec(query).all()

    return QuestionListResponse(
        count=len(questions),
        questions=[
            QuestionResponse(
                id=q.id,
                skill_name=q.skill.name if q.skill else skill_name or "Unknown",
                question_text=q.question_text,
                reference_answer=q.reference_answer,
                rubric=q.rubric,
                difficulty=q.difficulty,
                question_type=q.question_type
            )
            for q in questions
        ]
    )


@router.get("/assessments/questions/for-candidate", response_model=QuestionsForCandidateResponse, tags=["Assessment Questions"])
def get_questions_for_candidate(
    skill_name: str,
    num_questions: int = 5,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Returns candidate-safe questions (without reference answers or rubrics) for taking tests.
    """
    skill = db.exec(select(Skill).where(Skill.name == skill_name)).first()
    if not skill:
        raise HTTPException(status_code=400, detail=f"Skill '{skill_name}' not found in controlled catalog")

    all_questions = db.exec(
        select(AssessmentQuestion).where(AssessmentQuestion.skill_id == skill.id)
    ).all()

    if not all_questions:
        return QuestionsForCandidateResponse(
            skill_name=skill_name,
            num_requested=num_questions,
            num_returned=0,
            questions=[]
        )

    selected = random.sample(all_questions, min(num_questions, len(all_questions)))

    return QuestionsForCandidateResponse(
        skill_name=skill_name,
        num_requested=num_questions,
        num_returned=len(selected),
        questions=[
            PublicQuestionResponse(
                id=q.id,
                skill_name=skill.name,
                question_text=q.question_text,
                difficulty=q.difficulty,
                question_type=q.question_type
            )
            for q in selected
        ]
    )


@router.post("/assessment/save", response_model=SaveAssessmentResponse, tags=["Assessment Results"])
def save_assessment_result(
    req: SaveAssessmentRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Securely saves an assessment score bound to the authenticated user's ID.
    Prevents unauthorized tampering of other users' assessment scores.
    """
    # Student can only save for themselves; Admin can save on behalf of others if specified
    effective_user_id = current_user.id
    if current_user.role == "admin" and req.user_id:
        effective_user_id = req.user_id

    existing = db.exec(
        select(AssessmentResult).where(
            AssessmentResult.user_id == effective_user_id,
            AssessmentResult.skill_id == req.skill_id
        )
    ).first()

    if existing:
        existing.score = req.score
        existing.questions_answered = req.questions_answered
        existing.integrity_score = req.integrity_score if req.integrity_score is not None else 100
        existing.violations_count = req.violations_count or 0
        existing.violation_logs = req.violation_logs or "[]"
        existing.proctoring_status = req.proctoring_status or "Clear"
        db.add(existing)
    else:
        result = AssessmentResult(
            user_id=effective_user_id,
            skill_id=req.skill_id,
            score=req.score,
            questions_answered=req.questions_answered,
            integrity_score=req.integrity_score if req.integrity_score is not None else 100,
            violations_count=req.violations_count or 0,
            violation_logs=req.violation_logs or "[]",
            proctoring_status=req.proctoring_status or "Clear"
        )
        db.add(result)

    db.commit()

    return SaveAssessmentResponse(
        message="Assessment saved successfully with AI proctoring telemetry",
        score=req.score,
        user_id=effective_user_id,
        integrity_score=req.integrity_score if req.integrity_score is not None else 100,
        proctoring_status=req.proctoring_status or "Clear"
    )


@router.get("/assessment/results/{user_id}", tags=["Assessment Results"])
def get_user_results(
    user_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches assessment results with tenant isolation:
    Students can only view their own results; Industry, Academia, and Admin can view student results.
    """
    if current_user.role not in ["admin", "industry", "academia"] and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorized to view another student's assessment results."
        )

    results = db.exec(
        select(AssessmentResult).where(AssessmentResult.user_id == user_id)
    ).all()

    formatted_results = []
    for r in results:
        skill = db.get(Skill, r.skill_id)
        formatted_results.append({
            "skill_id": r.skill_id,
            "skill_name": skill.name if skill else f"Skill #{r.skill_id}",
            "score": r.score,
            "questions_answered": r.questions_answered,
            "integrity_score": getattr(r, "integrity_score", 100),
            "violations_count": getattr(r, "violations_count", 0),
            "proctoring_status": getattr(r, "proctoring_status", "Clear"),
            "violation_logs": getattr(r, "violation_logs", "[]")
        })

    return {
        "user_id": user_id,
        "results": formatted_results
    }