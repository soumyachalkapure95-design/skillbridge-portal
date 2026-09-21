from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, select
from typing import Optional, Dict, Any
from datetime import datetime

from app.database import get_session
from app.models import (
    User,
    StudentProfile,
    IndustryProfile,
    AcademiaProfile,
    AdminProfile
)
from app.auth import get_password_hash, create_access_token, get_current_user, verify_password

router = APIRouter()

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = Field(default="student", description="student, industry, academia, admin")

    # Student specific fields
    branch: Optional[str] = "Computer Science"
    year: Optional[int] = 3
    college: Optional[str] = "University Partner"
    cgpa: Optional[float] = 8.0

    # Industry specific fields
    company: Optional[str] = None
    designation: Optional[str] = None
    industry_sector: Optional[str] = "Technology"
    company_size: Optional[str] = "50-200"
    website: Optional[str] = None
    location: Optional[str] = "Remote"

    # Academia specific fields
    institution: Optional[str] = None
    department: Optional[str] = "Computer Science & Engineering"
    faculty_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = Field(default="student", description="student, industry, academia, admin")


def get_profile_data_for_user(user: User, session: Session) -> Dict[str, Any]:
    """Helper to return role-specific profile data from dedicated tables."""
    role = (user.role or "student").lower()
    profile_info: Dict[str, Any] = {
        "id": user.id,
        "name": user.full_name or user.email.split("@")[0],
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }

    if role == "student":
        student_prof = session.exec(
            select(StudentProfile).where(StudentProfile.user_id == user.id)
        ).first()
        if student_prof:
            profile_info.update({
                "college": student_prof.college,
                "branch": student_prof.branch,
                "year": student_prof.year,
                "cgpa": student_prof.cgpa,
                "bio": student_prof.bio,
                "github_url": student_prof.github_url,
                "linkedin_url": student_prof.linkedin_url
            })
        else:
            profile_info.update({
                "college": user.college or "University Partner",
                "branch": user.branch or "Computer Science",
                "year": user.year or 3,
                "cgpa": user.cgpa or 8.0
            })

    elif role == "industry":
        ind_prof = session.exec(
            select(IndustryProfile).where(IndustryProfile.user_id == user.id)
        ).first()
        if ind_prof:
            profile_info.update({
                "company": ind_prof.company_name,
                "company_name": ind_prof.company_name,
                "designation": ind_prof.designation,
                "industry_sector": ind_prof.industry_sector,
                "company_size": ind_prof.company_size,
                "website": ind_prof.website,
                "location": ind_prof.location
            })
        else:
            profile_info.update({
                "company": user.company or "Industry Partner",
                "company_name": user.company or "Industry Partner",
                "designation": user.designation or "Talent Recruiter"
            })

    elif role == "academia":
        acad_prof = session.exec(
            select(AcademiaProfile).where(AcademiaProfile.user_id == user.id)
        ).first()
        if acad_prof:
            profile_info.update({
                "institution": acad_prof.institution_name,
                "institution_name": acad_prof.institution_name,
                "department": acad_prof.department,
                "designation": acad_prof.designation,
                "faculty_id": acad_prof.faculty_id
            })
        else:
            profile_info.update({
                "institution": user.institution or "Academic Institute",
                "institution_name": user.institution or "Academic Institute",
                "department": user.department or "Computer Science & Engineering"
            })

    elif role == "admin":
        admin_prof = session.exec(
            select(AdminProfile).where(AdminProfile.user_id == user.id)
        ).first()
        if admin_prof:
            profile_info.update({
                "admin_level": admin_prof.admin_level,
                "department": admin_prof.department,
                "permissions": admin_prof.permissions
            })
        else:
            profile_info.update({
                "admin_level": "superadmin",
                "department": "Platform Operations"
            })

    return profile_info


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register_user(
    payload: RegisterRequest,
    session: Session = Depends(get_session)
):
    """
    Create a new User account and insert the corresponding profile row into
    its dedicated role table (student_profiles, industry_profiles, academia_profiles, or admin_profiles).
    """
    allowed_roles = {"student", "industry", "academia", "admin"}
    target_role = payload.role.strip().lower()

    if target_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be one of: student, industry, academia, admin."
        )

    existing_user = session.exec(
        select(User).where(User.email == payload.email.lower().strip())
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists."
        )

    # 1. Create main User record
    new_user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.lower().strip(),
        hashed_password=get_password_hash(payload.password),
        role=target_role,
        branch=payload.branch,
        year=payload.year,
        college=payload.college,
        cgpa=payload.cgpa,
        company=payload.company,
        designation=payload.designation,
        institution=payload.institution,
        department=payload.department,
        is_active=True,
        created_at=datetime.utcnow()
    )

    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    # 2. Create corresponding dedicated profile table record
    if target_role == "student":
        student_profile = StudentProfile(
            user_id=new_user.id,
            college=payload.college or "University Partner",
            branch=payload.branch or "Computer Science",
            year=payload.year or 3,
            cgpa=payload.cgpa or 8.0,
            skills_summary="[]",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(student_profile)

    elif target_role == "industry":
        industry_profile = IndustryProfile(
            user_id=new_user.id,
            company_name=payload.company or payload.full_name or "Enterprise Partner",
            designation=payload.designation or "Hiring Manager",
            industry_sector=payload.industry_sector or "Technology",
            company_size=payload.company_size or "50-200",
            website=payload.website,
            location=payload.location or "Remote",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(industry_profile)

    elif target_role == "academia":
        academia_profile = AcademiaProfile(
            user_id=new_user.id,
            institution_name=payload.institution or "Academic Institute",
            department=payload.department or "Computer Science & Engineering",
            designation=payload.designation or "Faculty Member",
            faculty_id=payload.faculty_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(academia_profile)

    elif target_role == "admin":
        admin_profile = AdminProfile(
            user_id=new_user.id,
            admin_level="superadmin",
            department="Platform Operations",
            permissions="[\"all\"]",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(admin_profile)

    session.commit()

    access_token = create_access_token(
        data={
            "sub": new_user.email,
            "role": new_user.role,
            "user_id": new_user.id
        }
    )

    user_details = get_profile_data_for_user(new_user, session)

    return {
        "message": f"Registration successful as {target_role.title()}",
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_details
    }


@router.post("/auth/login")
def login_user(
    payload: LoginRequest,
    session: Session = Depends(get_session)
):
    """
    Log in an existing user with verified credentials and strictly enforce
    that the chosen portal role matches the user's registered role in the database.
    """
    user = session.exec(
        select(User).where(User.email == payload.email.lower().strip())
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    # Enforce role matching between login portal selection and DB role
    requested_role = payload.role.strip().lower()
    user_actual_role = (user.role or "student").strip().lower()

    if user_actual_role != requested_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role Mismatch: This account is registered as '{user_actual_role.title()}', not '{requested_role.title()}'. Please select '{user_actual_role.title()}' on the login screen to sign in."
        )

    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role,
            "user_id": user.id
        }
    )

    user_details = get_profile_data_for_user(user, session)

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_details
    }


@router.get("/auth/me")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Return comprehensive profile details for the authenticated user from their dedicated role table.
    """
    return get_profile_data_for_user(current_user, session)