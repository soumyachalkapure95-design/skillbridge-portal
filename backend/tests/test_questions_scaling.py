import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_questions_scaling_all_skills():
    skills = ['Python', 'React']
    for skill in skills:
        for count in [5, 10]:
            response = client.post("/api/llm/generate-questions", json={
                "skill_name": skill,
                "num_questions": count,
                "difficulty": "Medium"
            })
            assert response.status_code == 200, f"Failed for {skill}: {response.text}"
            data = response.json()
            questions = data.get("questions", [])
            assert len(questions) == count, f"Skill {skill} requested {count} questions, got {len(questions)}"
            print(f"VERIFIED: {skill} -> {len(questions)}/{count} technical questions generated.")

if __name__ == "__main__":
    test_questions_scaling_all_skills()
    print("ALL QUESTION SCALING TESTS PASSED SUCCESSFULLY!")
