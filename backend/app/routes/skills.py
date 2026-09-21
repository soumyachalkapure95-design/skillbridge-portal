from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.database import get_session
from app.models import Skill

router = APIRouter()


SKILL_CATALOG = [
    {
        "name": "Python",
        "category": "Programming",
        "description": "Python syntax, functions, OOP, exceptions, data structures, and problem solving."
    },
    {
        "name": "Java",
        "category": "Programming",
        "description": "Java syntax, OOP, collections, exceptions, and backend fundamentals."
    },
    {
        "name": "C++",
        "category": "Programming",
        "description": "C++ syntax, STL, OOP, memory concepts, and competitive programming."
    },
    {
        "name": "JavaScript",
        "category": "Programming",
        "description": "JavaScript fundamentals, DOM, async programming, promises, and browser APIs."
    },
    {
        "name": "SQL",
        "category": "Database",
        "description": "Queries, joins, grouping, normalization, indexing, and relational modelling."
    },
    {
        "name": "MongoDB",
        "category": "Database",
        "description": "Document databases, CRUD operations, schema design, and aggregation."
    },
    {
        "name": "React",
        "category": "Frontend",
        "description": "Components, hooks, state management, API integration, and responsive interfaces."
    },
    {
        "name": "HTML",
        "category": "Frontend",
        "description": "Semantic HTML, forms, accessibility, and document structure."
    },
    {
        "name": "CSS",
        "category": "Frontend",
        "description": "Responsive layouts, Flexbox, Grid, styles, and visual design fundamentals."
    },
    {
        "name": "Node.js",
        "category": "Backend",
        "description": "Server-side JavaScript, APIs, asynchronous programming, and modules."
    },
    {
        "name": "FastAPI",
        "category": "Backend",
        "description": "Python REST APIs, routing, validation, dependency injection, and documentation."
    },
    {
        "name": "REST APIs",
        "category": "Backend",
        "description": "HTTP methods, status codes, request and response design, and authentication."
    },
    {
        "name": "Git",
        "category": "Developer Tools",
        "description": "Commits, branches, pull requests, merges, and conflict resolution."
    },
    {
        "name": "Docker",
        "category": "Developer Tools",
        "description": "Images, containers, Dockerfiles, volumes, and app packaging."
    },
    {
        "name": "Linux",
        "category": "Developer Tools",
        "description": "Command line, files, permissions, processes, and shell basics."
    },
    {
        "name": "Data Structures",
        "category": "CS Fundamentals",
        "description": "Arrays, linked lists, stacks, queues, trees, graphs, heaps, and hash maps."
    },
    {
        "name": "Algorithms",
        "category": "CS Fundamentals",
        "description": "Searching, sorting, recursion, dynamic programming, greedy methods, and complexity."
    },
    {
        "name": "Object-Oriented Programming",
        "category": "CS Fundamentals",
        "description": "Encapsulation, inheritance, polymorphism, abstraction, and SOLID principles."
    },
    {
        "name": "DBMS",
        "category": "CS Fundamentals",
        "description": "Transactions, ACID, normalization, concurrency, and database indexing."
    },
    {
        "name": "Operating Systems",
        "category": "CS Fundamentals",
        "description": "Processes, threads, scheduling, memory management, deadlocks, and file systems."
    },
    {
        "name": "Computer Networks",
        "category": "CS Fundamentals",
        "description": "TCP/IP, HTTP, DNS, sockets, network layers, and web communication."
    },
    {
        "name": "Machine Learning",
        "category": "AI and Data",
        "description": "Supervised learning, model evaluation, feature engineering, and validation."
    },
    {
        "name": "Data Analysis",
        "category": "AI and Data",
        "description": "Cleaning, exploratory analysis, statistics, visualization, and reporting."
    },
    {
        "name": "Generative AI",
        "category": "AI and Data",
        "description": "LLMs, prompting, RAG, evaluation, and responsible AI usage."
    },
    {
        "name": "Communication",
        "category": "Professional Skills",
        "description": "Clear technical explanation, structured answers, listening, and documentation."
    },
    {
        "name": "Problem Solving",
        "category": "Professional Skills",
        "description": "Debugging, decomposition, logical reasoning, and solution evaluation."
    },
    {
        "name": "Teamwork",
        "category": "Professional Skills",
        "description": "Collaboration, feedback, ownership, coordination, and conflict resolution."
    }
]


@router.post("/skills/seed-catalog")
def seed_skill_catalog(session: Session = Depends(get_session)):
    """
    Add controlled skills to SQLite only if they do not already exist.
    It is safe to run more than once.
    """
    added = 0
    skipped = 0

    for skill_data in SKILL_CATALOG:
        existing = session.exec(
            select(Skill).where(Skill.name == skill_data["name"])
        ).first()

        if existing:
            skipped += 1
            continue

        session.add(
            Skill(
                name=skill_data["name"],
                category=skill_data["category"],
                description=skill_data["description"],
                is_trending=False,
                trend_score=0.0
            )
        )
        added += 1

    session.commit()

    return {
        "message": "Controlled skill catalog seeded successfully",
        "added": added,
        "skipped_existing": skipped,
        "total_catalog_skills": len(SKILL_CATALOG)
    }


@router.get("/skills")
def get_skills(
    category: str | None = None,
    session: Session = Depends(get_session)
):
    """
    Return the platform-controlled skills used in assessments and matching.
    """
    query = select(Skill)

    if category:
        query = query.where(Skill.category == category)

    skills = session.exec(query.order_by(Skill.category, Skill.name)).all()

    return {
        "count": len(skills),
        "skills": [
            {
                "id": skill.id,
                "name": skill.name,
                "category": skill.category,
                "description": skill.description
            }
            for skill in skills
        ]
    }