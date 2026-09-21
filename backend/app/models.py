from sqlmodel import SQLModel, Field, Relationship
from typing import List, Optional
from datetime import datetime

class User(SQLModel, table=True):
    __tablename__ = "users"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(..., unique=True, index=True)
    hashed_password: str
    full_name: Optional[str] = None
    role: str = Field(default="student", index=True)  # "student", "industry", "academia", "admin"
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Legacy fields retained for backwards compatibility with existing db rows
    branch: Optional[str] = None
    year: Optional[int] = None
    college: Optional[str] = None
    cgpa: Optional[float] = None
    company: Optional[str] = None
    designation: Optional[str] = None
    institution: Optional[str] = None
    department: Optional[str] = None
    
    # Relationships to dedicated role tables
    student_profile: Optional["StudentProfile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False}
    )
    industry_profile: Optional["IndustryProfile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False}
    )
    academia_profile: Optional["AcademiaProfile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False}
    )
    admin_profile: Optional["AdminProfile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False}
    )
    
    assessment_results: List["AssessmentResult"] = Relationship(back_populates="user")
    applications: List["Application"] = Relationship(back_populates="user")
    learning_progress: List["UserLearningProgress"] = Relationship(back_populates="user")


class StudentProfile(SQLModel, table=True):
    __tablename__ = "student_profiles"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="users.id", unique=True, index=True)
    college: Optional[str] = Field(default="University Partner")
    branch: Optional[str] = Field(default="Computer Science")
    year: Optional[int] = Field(default=3)
    cgpa: Optional[float] = Field(default=8.0)
    skills_summary: Optional[str] = Field(default="[]")  # JSON string of skills
    bio: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: Optional[User] = Relationship(back_populates="student_profile")


class IndustryProfile(SQLModel, table=True):
    __tablename__ = "industry_profiles"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="users.id", unique=True, index=True)
    company_name: str = Field(default="Enterprise Partner", index=True)
    designation: Optional[str] = Field(default="Talent Partner")
    industry_sector: Optional[str] = Field(default="Technology")
    company_size: Optional[str] = Field(default="50-200")
    website: Optional[str] = None
    location: Optional[str] = Field(default="Remote")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: Optional[User] = Relationship(back_populates="industry_profile")


class AcademiaProfile(SQLModel, table=True):
    __tablename__ = "academia_profiles"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="users.id", unique=True, index=True)
    institution_name: str = Field(default="Academic Institute", index=True)
    department: Optional[str] = Field(default="Computer Science & Engineering")
    designation: Optional[str] = Field(default="Assistant Professor")
    faculty_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: Optional[User] = Relationship(back_populates="academia_profile")


class AdminProfile(SQLModel, table=True):
    __tablename__ = "admin_profiles"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="users.id", unique=True, index=True)
    admin_level: str = Field(default="superadmin")
    department: Optional[str] = Field(default="Platform Operations")
    permissions: str = Field(default="[\"all\"]")  # JSON string
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: Optional[User] = Relationship(back_populates="admin_profile")


class Skill(SQLModel, table=True):
    __tablename__ = "skills"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(..., unique=True, index=True)
    category: str
    description: Optional[str] = None
    is_trending: bool = Field(default=False)
    trend_score: float = Field(default=0.0)
    
    assessment_questions: List["AssessmentQuestion"] = Relationship(back_populates="skill")
    assessment_results: List["AssessmentResult"] = Relationship(back_populates="skill")


class AssessmentQuestion(SQLModel, table=True):
    __tablename__ = "assessment_questions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    skill_id: int = Field(..., foreign_key="skills.id")
    question_text: str
    reference_answer: str
    rubric: str
    difficulty: str = Field(default="Medium")
    question_type: str = Field(default="Short Answer")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    skill: Optional[Skill] = Relationship(back_populates="assessment_questions")


class AssessmentResult(SQLModel, table=True):
    __tablename__ = "assessment_results"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="users.id")
    skill_id: int = Field(..., foreign_key="skills.id")
    score: int = Field(..., ge=0, le=100)
    questions_answered: int = Field(default=0)
    integrity_score: int = Field(default=100, ge=0, le=100)
    violations_count: int = Field(default=0)
    violation_logs: str = Field(default="[]")
    proctoring_status: str = Field(default="Clear")  # "Clear", "Suspicious", "Flagged"
    completed_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: Optional[User] = Relationship(back_populates="assessment_results")
    skill: Optional[Skill] = Relationship(back_populates="assessment_results")


class Internship(SQLModel, table=True):
    __tablename__ = "internships"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: Optional[int] = Field(default=None, foreign_key="users.id")
    title: str
    company_name: str
    description: str
    required_skills: str = Field(default="[]")
    stipend: int = Field(default=0)
    location: str = Field(default="Remote")
    type: str = Field(default="internship")
    application_deadline: Optional[datetime] = None
    is_active: bool = Field(default=True)
    source: str = Field(default="manual")
    external_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Application(SQLModel, table=True):
    __tablename__ = "applications"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="users.id")
    internship_id: int = Field(..., foreign_key="internships.id")
    status: str = Field(default="pending")
    applied_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: Optional[User] = Relationship(back_populates="applications")


class AssessmentSession(SQLModel, table=True):
    __tablename__ = "assessment_sessions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="users.id")
    skill_id: int = Field(..., foreign_key="skills.id")
    score: int = Field(default=0)
    completed: bool = Field(default=False)
    started_at: datetime = Field(default_factory=datetime.utcnow)


class SkillGapAnalysis(SQLModel, table=True):
    __tablename__ = "skill_gap_analysis"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="users.id")
    skill_id: int = Field(..., foreign_key="skills.id")
    gap_score: int = Field(default=0)
    recommended_resources: str = Field(default="[]")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class InterviewQuestion(SQLModel, table=True):
    __tablename__ = "interview_questions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    skill_id: int = Field(..., foreign_key="skills.id")
    question_text: str
    difficulty: str = Field(default="Medium")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserLearningProgress(SQLModel, table=True):
    __tablename__ = "user_learning_progress"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="users.id", index=True)
    target_role: str = Field(default="Full-Stack Web Developer")
    completed_milestones: str = Field(default="[]")  # JSON list of milestone IDs
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: Optional[User] = Relationship(back_populates="learning_progress")