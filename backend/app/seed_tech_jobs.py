import json
from sqlmodel import Session, select
from datetime import datetime
from app.database import engine
from app.models import Internship

tech_jobs = [
    {
        "title": "Full Stack Engineer Intern (Python, React, FastAPI)",
        "company_name": "Nexus Cloud Solutions",
        "description": "Join our agile engineering team building high-performance cloud management tools. You will develop backend services in FastAPI, write PostgreSQL queries, and craft responsive user interfaces in React.",
        "required_skills": json.dumps(["Python", "React", "FastAPI", "SQL"]),
        "stipend": 35000,
        "location": "Remote / Hybrid",
        "type": "internship",
        "source": "manual",
        "external_url": "https://careers.nexuscloud.io",
        "is_active": True
    },
    {
        "title": "Backend Systems & API Intern (Python, SQL, Docker)",
        "company_name": "StripeTech Labs",
        "description": "Looking for a proactive backend developer with strong Python foundations. You will build microservices, manage database transactions, and deploy containerized Docker services.",
        "required_skills": json.dumps(["Python", "SQL", "Docker", "FastAPI"]),
        "stipend": 40000,
        "location": "Bangalore / Remote",
        "type": "internship",
        "source": "manual",
        "external_url": "https://careers.stripetech.io",
        "is_active": True
    },
    {
        "title": "Modern Frontend React Developer",
        "company_name": "ViteFlow Interactive",
        "description": "We are seeking a creative frontend developer skilled in React, JavaScript (ES6+), component architecture, and modern CSS/glassmorphism design systems.",
        "required_skills": json.dumps(["React", "JavaScript", "HTML", "CSS"]),
        "stipend": 30000,
        "location": "Remote",
        "type": "internship",
        "source": "manual",
        "external_url": "https://viteflow.dev/jobs",
        "is_active": True
    },
    {
        "title": "AI & Data Science Engineering Intern",
        "company_name": "DeepMetrics AI",
        "description": "Work on applied generative AI agents, LLM pipelines, and automated data processing using Python, Data Analysis, and Machine Learning frameworks.",
        "required_skills": json.dumps(["Python", "Machine Learning", "Data Analysis", "SQL"]),
        "stipend": 45000,
        "location": "Hyderabad / Remote",
        "type": "internship",
        "source": "manual",
        "external_url": "https://deepmetrics.ai/careers",
        "is_active": True
    }
]

with Session(engine) as session:
    for job_data in tech_jobs:
        existing = session.exec(
            select(Internship).where(Internship.title == job_data["title"])
        ).first()
        if not existing:
            job = Internship(
                company_id=1,
                created_at=datetime.utcnow(),
                **job_data
            )
            session.add(job)
    session.commit()
    print("Database seeded with high-demand tech jobs successfully!")
