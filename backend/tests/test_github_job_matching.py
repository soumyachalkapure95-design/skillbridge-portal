import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_access_token

client = TestClient(app)

def test_github_analysis_endpoint():
    token = create_access_token({"sub": "alice_test@skillbridge.edu", "role": "student", "user_id": 1})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/github/analyze", json={"username": "torvalds"}, headers=headers)
    assert res.status_code == 200, f"Error: {res.text}"
    data = res.json()
    assert "username" in data
    assert "public_repos" in data
    assert "detected_skills" in data
    assert "languages" in data
    print("SUCCESS: GitHub profile analysis parsed successfully ->", data["username"])


def test_jobs_github_match_endpoint():
    token = create_access_token({"sub": "alice_test@skillbridge.edu", "role": "student", "user_id": 1})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/jobs/github-match", json={
        "username": "alice_dev",
        "user_id": 1
    }, headers=headers)

    assert res.status_code == 200, f"Error: {res.text}"
    data = res.json()
    assert "github_profile" in data
    assert "jobs" in data
    assert len(data["jobs"]) > 0

    top_job = data["jobs"][0]
    assert "match_score" in top_job
    assert 0 <= top_job["match_score"] <= 100
    assert "matched_skills" in top_job
    assert "learning_recommendation" in top_job

    clean_title = top_job['title'].encode('ascii', 'ignore').decode('ascii')
    print(f"SUCCESS: Job matching evaluated {len(data['jobs'])} jobs. Top match: {clean_title} ({top_job['match_score']}%)")


if __name__ == "__main__":
    test_github_analysis_endpoint()
    test_jobs_github_match_endpoint()
    print("ALL GITHUB JOB MATCHING TESTS PASSED!")
