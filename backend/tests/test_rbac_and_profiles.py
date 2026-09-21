import sys
import os
import requests
import json

# Set standard output encoding to utf-8 if possible
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=" * 60)
    print("[START] SkillBridge RBAC & DB Profile Separation Test Suite")
    print("=" * 60)

    # 1. Register test users for each role
    users = {
        "student": {
            "full_name": "Alice Student",
            "email": "alice_test@skillbridge.edu",
            "password": "Password123!",
            "role": "student",
            "college": "National Tech Institute",
            "branch": "Computer Science",
            "year": 4,
            "cgpa": 9.2
        },
        "industry": {
            "full_name": "Bob Recruiter",
            "email": "bob_recruiter_test@skillbridge.edu",
            "password": "Password123!",
            "role": "industry",
            "company": "TechNova Solutions",
            "designation": "Head of Engineering Talent",
            "industry_sector": "Software & AI"
        },
        "academia": {
            "full_name": "Dr. Clara Faculty",
            "email": "clara_faculty_test@skillbridge.edu",
            "password": "Password123!",
            "role": "academia",
            "institution": "Apex University",
            "department": "Computer Science & Engineering",
            "designation": "Associate Professor"
        },
        "admin": {
            "full_name": "David Superadmin",
            "email": "david_admin_test@skillbridge.edu",
            "password": "Password123!",
            "role": "admin"
        }
    }

    tokens = {}

    print("\n--- TEST 1: User Registration with Dedicated Profiles ---")
    for role_name, payload in users.items():
        res = requests.post(f"{BASE_URL}/auth/register", json=payload)
        if res.status_code == 201:
            data = res.json()
            tokens[role_name] = data["access_token"]
            print(f"[PASS] Registered {role_name}: {payload['email']} (User ID: {data['user']['id']})")
        elif res.status_code == 409:
            print(f"[INFO] {role_name} ({payload['email']}) already exists. Proceeding to login...")
            login_res = requests.post(f"{BASE_URL}/auth/login", json={
                "email": payload["email"],
                "password": payload["password"],
                "role": role_name
            })
            tokens[role_name] = login_res.json()["access_token"]
        else:
            print(f"[FAIL] Failed to register {role_name}: {res.status_code} - {res.text}")

    print("\n--- TEST 2: Role Verification at Login ---")
    for role_name, payload in users.items():
        # Correct role login
        login_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": payload["email"],
            "password": payload["password"],
            "role": role_name
        })
        if login_res.status_code == 200:
            tokens[role_name] = login_res.json()["access_token"]
            print(f"[PASS] Correct role login success for {role_name}: Token issued")
        else:
            print(f"[FAIL] Login failed for {role_name}: {login_res.status_code} - {login_res.text}")

        # Incorrect role login attempt (e.g. Student trying to log in as Admin)
        wrong_role = "admin" if role_name != "admin" else "student"
        spoof_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": payload["email"],
            "password": payload["password"],
            "role": wrong_role
        })
        if spoof_res.status_code == 403:
            print(f"[PASS] Blocked role spoofing for {role_name} attempting to login as {wrong_role}: {spoof_res.json().get('detail')}")
        else:
            print(f"[FAIL] Spoof protection failed! Expected 403, got {spoof_res.status_code}: {spoof_res.text}")

    print("\n--- TEST 3: RBAC Endpoint Protection ---")
    # Admin Stats: only Admin allowed
    res_admin_by_student = requests.get(f"{BASE_URL}/admin/stats", headers={"Authorization": f"Bearer {tokens['student']}"})
    assert res_admin_by_student.status_code == 403, f"Expected 403 for student accessing admin stats, got {res_admin_by_student.status_code}"
    print("[PASS] Student blocked from /api/admin/stats (403 Forbidden)")

    res_admin_by_admin = requests.get(f"{BASE_URL}/admin/stats", headers={"Authorization": f"Bearer {tokens['admin']}"})
    assert res_admin_by_admin.status_code == 200, f"Expected 200 for admin accessing admin stats, got {res_admin_by_admin.status_code}"
    admin_data = res_admin_by_admin.json()
    print(f"[PASS] Admin authorized for /api/admin/stats: {admin_data}")

    # Industry Candidates: Industry & Admin allowed; Student blocked
    res_cand_by_student = requests.get(f"{BASE_URL}/industry/candidates", headers={"Authorization": f"Bearer {tokens['student']}"})
    assert res_cand_by_student.status_code == 403, f"Expected 403 for student accessing candidates, got {res_cand_by_student.status_code}"
    print("[PASS] Student blocked from /api/industry/candidates (403 Forbidden)")

    res_cand_by_ind = requests.get(f"{BASE_URL}/industry/candidates", headers={"Authorization": f"Bearer {tokens['industry']}"})
    assert res_cand_by_ind.status_code == 200, f"Expected 200 for industry accessing candidates, got {res_cand_by_ind.status_code}"
    print(f"[PASS] Industry authorized for /api/industry/candidates: Found {res_cand_by_ind.json()['count']} candidate(s)")

    # Academia Analytics: Academia & Admin allowed; Student blocked
    res_acad_by_student = requests.get(f"{BASE_URL}/academia/analytics", headers={"Authorization": f"Bearer {tokens['student']}"})
    assert res_acad_by_student.status_code == 403, f"Expected 403 for student accessing academia analytics, got {res_acad_by_student.status_code}"
    print("[PASS] Student blocked from /api/academia/analytics (403 Forbidden)")

    res_acad_by_acad = requests.get(f"{BASE_URL}/academia/analytics", headers={"Authorization": f"Bearer {tokens['academia']}"})
    assert res_acad_by_acad.status_code == 200, f"Expected 200 for academia accessing analytics, got {res_acad_by_acad.status_code}"
    print(f"[PASS] Academia authorized for /api/academia/analytics: Enrolled students: {res_acad_by_acad.json()['total_enrolled_students']}")

    print("\n--- TEST 4: Student Assessment Saving & Data Isolation ---")
    save_res = requests.post(f"{BASE_URL}/assessment/save", json={
        "skill_id": 1,
        "score": 90,
        "questions_answered": 3
    }, headers={"Authorization": f"Bearer {tokens['student']}"})
    assert save_res.status_code == 200, f"Expected 200, got {save_res.status_code}: {save_res.text}"
    student_user_id = save_res.json()["user_id"]
    print(f"[PASS] Student saved assessment score 90 for skill_id 1 (bound to User ID {student_user_id})")

    # Student accessing own results
    res_own = requests.get(f"{BASE_URL}/assessment/results/{student_user_id}", headers={"Authorization": f"Bearer {tokens['student']}"})
    assert res_own.status_code == 200, f"Expected 200, got {res_own.status_code}"
    print(f"[PASS] Student successfully read own assessment results: {res_own.json()['results']}")

    # Another student trying to access student's results (register student 2)
    s2_reg = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Eve Sneaky",
        "email": "eve_sneaky@skillbridge.edu",
        "password": "Password123!",
        "role": "student"
    })
    s2_token = s2_reg.json().get("access_token") if s2_reg.status_code == 201 else requests.post(f"{BASE_URL}/auth/login", json={
        "email": "eve_sneaky@skillbridge.edu",
        "password": "Password123!",
        "role": "student"
    }).json()["access_token"]

    res_eavesdrop = requests.get(f"{BASE_URL}/assessment/results/{student_user_id}", headers={"Authorization": f"Bearer {s2_token}"})
    assert res_eavesdrop.status_code == 403, f"Expected 403 for unauthorized student reading another student's results, got {res_eavesdrop.status_code}"
    print(f"[PASS] Blocked unauthorized student from reading Alice's assessment results (403 Forbidden)")

    print("\n" + "=" * 60)
    print("[SUCCESS] ALL RBAC, PROFILE SEPARATION & DATA ISOLATION TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
