import os
import json
import networkx as nx

# ─── Load Environment Variables ───
def load_env():
    paths = [".env", "../.env", "./backend/.env"]
    for path in paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip()
            print(f"Loaded environment variables from {path}")
            break

load_env()

# ─── Class State Pelacakan Sesi Belajar (Multi-session support) ───
class UserSession:
    def __init__(self):
        self.course = None             # "Database", "Orarkom", "Struktur Data"
        self.learning_style = None      # "Visual", "Auditorial", "Praktikal"
        self.current_node = None        # Node topik aktif saat ini (dict)
        self.mastery = {}               # topic_id -> probability of mastery (float)
        self.fsrs_cards = {}            # topic_id -> SM-2 card data (dict)
        self.remedial_attempts = 0      # Jumlah percobaan salah berturut-turut pada topik saat ini
        self.override_active = False    # Override manual oleh asisten/dosen
        self.override_node = None       # ID Node hasil override
        self.syllabus = []              # Daftar lengkap topik
        self.graph = None               # DAG Prerequisite dari NetworkX

# ─── Registry Sesi: session_id -> {"session_state": UserSession, "chat_history": list} ───
session_registry = {}

def get_session(session_id: str):
    if not session_id:
        session_id = "default_session"
    if session_id not in session_registry:
        session_registry[session_id] = {
            "session_state": UserSession(),
            "chat_history": []
        }
    return session_registry[session_id]["session_state"], session_registry[session_id]["chat_history"]
