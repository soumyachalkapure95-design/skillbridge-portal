from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_db_and_tables

# Import all routers
from app.routes import jobs, auth_routes, skills, assessments, llm_questions, analytics, learning_paths

app = FastAPI(
    title="SkillBridge - SIH26044",
    description="AI-powered Academia-Industry Collaboration Portal with Real-time Data",
    version="1.0.0"
)

import os

# CORS for frontend
allowed_origins_env = os.getenv("CORS_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in allowed_origins else allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    create_db_and_tables()
    print("🚀 SkillBridge API started successfully")

@app.get("/")
async def read_root():
    return {
        "message": "Welcome to SkillBridge API - SIH26044",
        "version": "1.0.0",
        "status": "running",
        "features": [
            "Live opportunity synchronization from Remotive and JSearch",
            "Student-focused internship and fresher-role filtering",
            "AI-powered skill assessments",
            "Skill-gap analysis and match percentage",
            "Personalized learning roadmaps"
        ]
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include routers
app.include_router(jobs.router, prefix="/api", tags=["Jobs & Internships"])
app.include_router(auth_routes.router, prefix="/api", tags=["Authentication"])
app.include_router(skills.router, prefix="/api", tags=["Skill Catalog"])
app.include_router(assessments.router, prefix="/api", tags=["Assessment Questions"])
app.include_router(llm_questions.router, prefix="/api", tags=["LLM Questions"])
app.include_router(analytics.router, prefix="/api", tags=["Live Platform Analytics"])
app.include_router(learning_paths.router, prefix="/api", tags=["AI Learning Paths & Gap Analysis"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)