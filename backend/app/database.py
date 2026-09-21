from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy import text
from datetime import datetime
import app.models
from app.models import (
    User,
    StudentProfile,
    IndustryProfile,
    AcademiaProfile,
    AdminProfile,
    Skill,
    AssessmentQuestion,
    AssessmentResult,
    Internship,
    Application,
    UserLearningProgress
)

DATABASE_URL = "sqlite:///./skillbridge.db"

# Create engine for direct SQL operations
engine = create_engine(DATABASE_URL, echo=False)

def migrate_sqlite_columns():
    """Ensure newly added columns exist in existing SQLite tables."""
    with engine.connect() as conn:
        # Check assessment_results columns
        try:
            result = conn.execute(text("PRAGMA table_info(assessment_results)")).fetchall()
            col_names = [row[1] for row in result]
            
            if "integrity_score" not in col_names:
                conn.execute(text("ALTER TABLE assessment_results ADD COLUMN integrity_score INTEGER DEFAULT 100"))
            if "violations_count" not in col_names:
                conn.execute(text("ALTER TABLE assessment_results ADD COLUMN violations_count INTEGER DEFAULT 0"))
            if "violation_logs" not in col_names:
                conn.execute(text("ALTER TABLE assessment_results ADD COLUMN violation_logs TEXT DEFAULT '[]'"))
            if "proctoring_status" not in col_names:
                conn.execute(text("ALTER TABLE assessment_results ADD COLUMN proctoring_status TEXT DEFAULT 'Clear'"))
            conn.commit()
        except Exception as e:
            print(f"Notice during column migration: {e}")

def create_db_and_tables():
    print("Creating database tables...")
    SQLModel.metadata.create_all(engine)
    migrate_sqlite_columns()
    
    # Backfill profile rows for any existing user records without corresponding profiles
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        for u in users:
            role = (u.role or "student").lower()
            if role == "student":
                prof = session.exec(select(StudentProfile).where(StudentProfile.user_id == u.id)).first()
                if not prof:
                    session.add(StudentProfile(
                        user_id=u.id,
                        college=u.college or "University Partner",
                        branch=u.branch or "Computer Science",
                        year=u.year or 3,
                        cgpa=u.cgpa or 8.0,
                        created_at=u.created_at or datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    ))
            elif role == "industry":
                prof = session.exec(select(IndustryProfile).where(IndustryProfile.user_id == u.id)).first()
                if not prof:
                    session.add(IndustryProfile(
                        user_id=u.id,
                        company_name=u.company or "Industry Partner",
                        designation=u.designation or "Talent Recruiter",
                        created_at=u.created_at or datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    ))
            elif role == "academia":
                prof = session.exec(select(AcademiaProfile).where(AcademiaProfile.user_id == u.id)).first()
                if not prof:
                    session.add(AcademiaProfile(
                        user_id=u.id,
                        institution_name=u.institution or "Academic Institute",
                        department=u.department or "Computer Science & Engineering",
                        created_at=u.created_at or datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    ))
            elif role == "admin":
                prof = session.exec(select(AdminProfile).where(AdminProfile.user_id == u.id)).first()
                if not prof:
                    session.add(AdminProfile(
                        user_id=u.id,
                        admin_level="superadmin",
                        department="Platform Operations",
                        created_at=u.created_at or datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    ))
        session.commit()
    print("✅ Database tables and role profiles initialized successfully")

def get_session():
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()