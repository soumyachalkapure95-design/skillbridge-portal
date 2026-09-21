import re
from bs4 import BeautifulSoup
import requests
import json
from datetime import datetime
from sqlmodel import Session, select
from app.database import engine
from app.models import Internship, User
import os
from dotenv import load_dotenv

load_dotenv()


def clean_html(html_text):
    """
    Convert raw HTML job description into readable plain text.
    """
    if not html_text:
        return ""

    soup = BeautifulSoup(html_text, "html.parser")
    text = soup.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text)


def is_student_friendly_job(job):
    """
    Keep internship, entry-level, junior, developer, and fresher roles.
    Only reject strictly senior/executive titles.
    """
    title = job.get("title", "").lower()

    # Reject only strictly executive/senior titles
    strictly_senior_titles = [
        "senior",
        "sr.",
        "principal",
        "director",
        "vp",
        "vice president",
        "head of",
        "chief",
        "architect"
    ]

    is_senior = any(word in title for word in strictly_senior_titles)
    return not is_senior


KNOWN_SKILLS = [
    "Python", "Java", "C++", "C#", "JavaScript", "TypeScript",
    "React", "Angular", "Vue", "Node.js", "Express", "FastAPI",
    "Django", "Flask", "SQL", "MySQL", "PostgreSQL", "MongoDB",
    "Redis", "Git", "Docker", "Kubernetes", "AWS", "Azure", "GCP",
    "HTML", "CSS", "Tailwind", "Machine Learning", "Data Science",
    "Data Analysis", "Artificial Intelligence", "Generative AI",
    "Data Structures", "Algorithms", "REST APIs", "Linux"
]


def extract_skills_from_description(description, title=""):
    """
    Identify known engineering skills inside job title and description.
    Returns list of matching skill names.
    """
    combined = f"{title} {description}".lower()
    detected = []

    for skill in KNOWN_SKILLS:
        # Match word boundary
        pattern = r"\b" + re.escape(skill.lower()) + r"\b"
        if re.search(pattern, combined):
            detected.append(skill)

    # Fallback to default full stack skills if none detected
    if not detected:
        detected = ["Python", "SQL", "Git"]

    return detected[:6]


# ============== 1. ARBEITNOW API (FREE, No Auth, 100+ Live Jobs) ==============

def fetch_arbeitnow_jobs():
    """
    Fetch live developer & tech opportunities from Arbeitnow API.
    """
    url = "https://www.arbeitnow.com/api/job-board-api"
    try:
        response = requests.get(url, timeout=4)
        if response.status_code != 200:
            return []
        data = response.json()
        raw_jobs = data.get("data", [])

        normalized = []
        for job in raw_jobs:
            if not isinstance(job, dict):
                continue

            clean_desc = clean_html(job.get("description", ""))
            norm = {
                "title": job.get("title", "Software Engineer"),
                "company": job.get("company_name", "Tech Company"),
                "location": "Remote" if job.get("remote") else job.get("location", "Remote"),
                "description": clean_desc,
                "url": job.get("url", ""),
                "source": "arbeitnow",
                "stipend": 25000 if "intern" in job.get("title", "").lower() else 45000
            }

            if is_student_friendly_job(norm):
                normalized.append(norm)

        print(f"[OK] Fetched {len(normalized)} jobs from Arbeitnow API")
        return normalized[:30]
    except Exception as e:
        print(f"❌ Arbeitnow fetch error: {e}")
        return []


# ============== 2. JOBICY API (FREE, No Auth, 50+ Remote Roles) ==============

def fetch_jobicy_jobs():
    """
    Fetch remote tech and software engineer jobs from Jobicy API.
    """
    url = "https://jobicy.com/api/v2/remote-jobs?count=25"
    try:
        response = requests.get(url, timeout=4)
        if response.status_code != 200:
            return []

        data = response.json()
        raw_jobs = data.get("jobs", [])

        normalized = []
        for job in raw_jobs:
            if not isinstance(job, dict):
                continue

            clean_desc = clean_html(job.get("jobDescription", ""))
            norm = {
                "title": job.get("jobTitle", "Software Developer"),
                "company": job.get("companyName", "Technology Partner"),
                "location": job.get("jobGeo", "Remote"),
                "description": clean_desc,
                "url": job.get("url", ""),
                "source": "jobicy",
                "stipend": 30000
            }

            if is_student_friendly_job(norm):
                normalized.append(norm)

        print(f"[OK] Fetched {len(normalized)} jobs from Jobicy API")
    except Exception as e:
        print(f"[ERROR] Jobicy fetch error: {e}")
        return []


# ============== 3. REMOTIVE API (FREE, Multi-Keyword) ==============

def fetch_remotive_jobs(keywords=["developer", "python", "react"]):
    """
    Fetch jobs from Remotive across multiple tech domains.
    """
    url = "https://remotive.com/api/remote-jobs"
    all_jobs = []
    seen_urls = set()

    for kw in keywords:
        try:
            resp = requests.get(url, params={"search": kw, "limit": 15}, timeout=4)
            if resp.status_code == 200:
                data = resp.json()
                jobs = data.get("jobs", [])
                for j in jobs:
                    job_url = j.get("url", "")
                    if job_url in seen_urls:
                        continue
                    seen_urls.add(job_url)

                    norm = {
                        "title": j.get("title", "Developer"),
                        "company": j.get("company_name", "Tech Startup"),
                        "location": j.get("candidate_required_location", "Remote"),
                        "description": clean_html(j.get("description", "")),
                        "url": job_url,
                        "source": "remotive",
                        "stipend": 35000
                    }

                    if is_student_friendly_job(norm):
                        all_jobs.append(norm)

            if len(all_jobs) >= 25:
                break
        except Exception as e:
            print(f"[ERROR] Remotive query '{kw}' failed: {e}")

    print(f"[OK] Fetched {len(all_jobs)} jobs from Remotive")
    return all_jobs


# Alias for backward compatibility
fetch_github_jobs = fetch_remotive_jobs


def fetch_jsearch_jobs(keyword="software engineer intern", location="Bangalore", num_pages=1):
    """
    Fetch jobs from JSearch API if RapidAPI key is configured.
    """
    rapidapi_key = os.getenv("RAPIDAPI_KEY")
    if not rapidapi_key or rapidapi_key == "get-free-key-from-rapidapi-com":
        return []

    url = "https://jsearch.p.rapidapi.com/search"
    headers = {
        "X-RapidAPI-Key": rapidapi_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
    }
    params = {
        "query": f"{keyword} {location}",
        "page": "1",
        "num_pages": str(num_pages)
    }
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=4)
        if resp.status_code == 200:
            return resp.json().get("data", [])
        return []
    except Exception:
        return []



# ============== SAVE TO SQLITE DATABASE ==============

def save_jobs_to_database(jobs_data, source="multi-source"):
    """
    Save normalized live jobs into SQLite.
    Deduplicates using Title + Company.
    """
    with Session(engine) as session:
        industry_user = session.exec(
            select(User).where(User.email == "jobs@skillbridge.com")
        ).first()

        if not industry_user:
            industry_user = User(
                email="jobs@skillbridge.com",
                hashed_password="external-source-no-login",
                full_name="SkillBridge Opportunity Network",
                role="industry",
                company="Global Tech Partners",
                designation="Automated Job Sync"
            )
            session.add(industry_user)
            session.commit()
            session.refresh(industry_user)

        saved_count = 0
        skipped_count = 0

        for job in jobs_data:
            if not isinstance(job, dict):
                skipped_count += 1
                continue

            title = job.get("title", "Software Opportunity").strip()[:200]
            company = job.get("company", "Tech Company").strip()[:200]
            external_url = job.get("url", "").strip()
            description = job.get("description", "No description provided").strip()
            stipend = job.get("stipend", 25000)
            location = job.get("location", "Remote")[:200]
            job_source = job.get("source", source)

            existing = session.exec(
                select(Internship).where(
                    Internship.title == title,
                    Internship.company_name == company
                )
            ).first()

            if existing:
                skipped_count += 1
                continue

            detected_skills = extract_skills_from_description(description, title)

            internship = Internship(
                company_id=industry_user.id,
                title=title,
                company_name=company,
                description=description[:2500],
                required_skills=json.dumps(detected_skills),
                stipend=stipend,
                location=location,
                type="internship" if "intern" in title.lower() else "full-time",
                is_active=True,
                source=job_source,
                external_url=external_url,
                created_at=datetime.utcnow()
            )

            session.add(internship)
            saved_count += 1

        session.commit()
        print(f"[DB SYNC] Saved {saved_count} new postings (Skipped {skipped_count} duplicates).")

        return {
            "saved": saved_count,
            "skipped": skipped_count,
            "source": source
        }


# ============== AGGREGATOR FUNCTION ==============

def fetch_all_jobs():
    """
    Fetches real-time jobs from Arbeitnow, Jobicy, and Remotive, and persists in SQLite.
    """
    print("[AGGREGATOR] Running multi-source job aggregation...")
    all_incoming = []

    # 1. Arbeitnow
    arbeitnow = fetch_arbeitnow_jobs()
    all_incoming.extend(arbeitnow)

    # 2. Jobicy
    jobicy = fetch_jobicy_jobs()
    all_incoming.extend(jobicy)

    # 3. Remotive
    remotive = fetch_remotive_jobs()
    all_incoming.extend(remotive)

    result = save_jobs_to_database(all_incoming, source="live-aggregators")

    return {
        "message": "Live opportunity aggregation completed",
        "total_fetched": len(all_incoming),
        "newly_saved_to_db": result["saved"],
        "duplicates_skipped": result["skipped"],
        "timestamp": datetime.utcnow().isoformat()
    }