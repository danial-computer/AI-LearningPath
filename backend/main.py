import os
import re
import shutil
import uuid
import json
import time
import networkx as nx
from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from google import genai
from google.genai import types

from supabase import create_client, Client
from core.auth import get_current_user

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

# ─── Buat folder uploads & sessions jika belum ada ───
UPLOAD_DIR = "uploads"
SESSIONS_DIR = "sessions"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(SESSIONS_DIR, exist_ok=True)

app = FastAPI(
    title="AI Learning Path API",
    description="Backend API untuk chatbot dan sistem rekomendasi belajar adaptif",
    version="1.0.0"
)

# ─── Static files untuk mengakses file yang diupload ───
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ─── CORS ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# ─── Registry Sesi: user_id_session_id -> {"session_state": UserSession, "chat_history": list} ───
session_registry = {}

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase_client: Client = None
if SUPABASE_URL and SERVICE_ROLE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)
        print("[Supabase] Client initialized successfully.")
    except Exception as e:
        print(f"[Supabase Warning] Failed to initialize client: {e}")
else:
    print("[Supabase Warning] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. DB storage disabled.")

def save_session_to_db(user_id: str, session_id: str):
    registry_key = f"{user_id}_{session_id}"
    if registry_key not in session_registry:
        return
    entry = session_registry[registry_key]
    session: UserSession = entry["session_state"]
    session_data = {
        "course": session.course,
        "learning_style": session.learning_style,
        "current_node": session.current_node,
        "mastery": session.mastery,
        "fsrs_cards": session.fsrs_cards,
        "remedial_attempts": session.remedial_attempts,
        "override_active": session.override_active,
        "override_node": session.override_node,
        "syllabus": session.syllabus,
    }
    chat_history = entry["chat_history"]
    
    if not supabase_client:
        return
        
    try:
        supabase_client.table("user_sessions").upsert({
            "user_id": user_id,
            "session_id": session_id,
            "session_data": session_data,
            "chat_history": chat_history,
            "updated_at": "now()"
        }, on_conflict="user_id,session_id").execute()
        print(f"[Supabase] Saved session {session_id[:8]}... for user {user_id[:8]}...")
    except Exception as e:
        print(f"[Supabase Error] Failed to save session {session_id}: {e}")

def load_session_from_db(user_id: str, session_id: str) -> bool:
    registry_key = f"{user_id}_{session_id}"
    if not supabase_client:
        return False
    try:
        response = supabase_client.table("user_sessions")\
            .select("session_data, chat_history")\
            .eq("user_id", user_id)\
            .eq("session_id", session_id)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            return False
            
        row = response.data[0]
        state = row.get("session_data", {})
        chat_history = row.get("chat_history", [])
        
        s = UserSession()
        s.course = state.get("course")
        s.learning_style = state.get("learning_style")
        s.current_node = state.get("current_node")
        s.mastery = state.get("mastery", {})
        s.fsrs_cards = state.get("fsrs_cards", {})
        s.remedial_attempts = state.get("remedial_attempts", 0)
        s.override_active = state.get("override_active", False)
        s.override_node = state.get("override_node")
        s.syllabus = state.get("syllabus", [])
        
        # Rebuild NetworkX graph from syllabus
        if s.syllabus:
            import networkx as nx
            G = nx.DiGraph()
            for topic in s.syllabus:
                G.add_node(topic["id"], **topic)
            for topic in s.syllabus:
                for prereq in topic.get("prerequisites", []):
                    if G.has_node(prereq):
                        G.add_edge(prereq, topic["id"])
            s.graph = G
            
        session_registry[registry_key] = {
            "session_state": s,
            "chat_history": chat_history
        }
        print(f"[Supabase] Loaded session {session_id[:8]}... from DB")
        return True
    except Exception as e:
        print(f"[Supabase Error] Failed to load session {session_id}: {e}")
        return False

def get_session(user_id: str, session_id: str):
    if not session_id:
        session_id = "default_session"
    registry_key = f"{user_id}_{session_id}"
    if registry_key not in session_registry:
        if not load_session_from_db(user_id, session_id):
            session_registry[registry_key] = {
                "session_state": UserSession(),
                "chat_history": []
            }
    return session_registry[registry_key]["session_state"], session_registry[registry_key]["chat_history"]

# ─── Database Flashcards Statik untuk Active Recall ───
FLASHCARDS_DB = {
    "DB_01_INTRO": [
        {"q": "Apa fungsi utama DBMS?", "a": "Mengelola, menyimpan, memanipulasi, dan memulihkan basis data secara efisien dan aman."},
        {"q": "Apa itu arsitektur 3-level ANSI-SPARC?", "a": "Arsitektur level Eksternal (User view), Konseptual (Community view), dan Internal (Physical view) untuk memisahkan struktur logis dan fisik data."}
    ],
    "DB_02_ERD": [
        {"q": "Apa beda entitas kuat dan entitas lemah?", "a": "Entitas kuat memiliki primary key unik sendiri, sedangkan entitas lemah bergantung pada entitas kuat lain untuk diidentifikasi."},
        {"q": "Apa arti kardinalitas relasi 1:N?", "a": "Satu baris data di tabel pertama dapat terhubung ke banyak baris di tabel kedua, tetapi baris di tabel kedua hanya dapat terhubung ke satu baris di tabel pertama."}
    ],
    "DB_03_RELATIONAL_MODEL": [
        {"q": "Apa itu Foreign Key?", "a": "Kolom di suatu tabel yang merujuk pada Primary Key tabel lain untuk menghubungkan kedua tabel."},
        {"q": "Apa yang dimaksud Integritas Referensial?", "a": "Aturan yang memastikan nilai Foreign Key di suatu tabel selalu menunjuk ke baris yang ada (valid) di tabel asal."}
    ],
    "DB_04_NORMALIZATION": [
        {"q": "Kapan suatu tabel memenuhi syarat Bentuk Normal Ketiga (3NF)?", "a": "Ketika sudah memenuhi 2NF dan tidak memiliki ketergantungan transitif (atribut non-key tidak boleh bergantung pada atribut non-key lainnya)."},
        {"q": "Apa tujuan utama dari proses Normalisasi Database?", "a": "Meminimalkan redundansi (duplikasi) data dan menghindari anomali ketika operasi insert, update, dan delete."}
    ],
    "DB_05_SQL_DDL": [
        {"q": "Apa itu DDL dalam SQL?", "a": "Data Definition Language, digunakan untuk mendefinisikan skema dan struktur database (perintah CREATE, ALTER, DROP)."}
    ],
    "OR_01_REPRESENTASI": [
        {"q": "Bagaimana cara merepresentasikan angka negatif -5 dalam biner 8-bit Two's Complement?", "a": "5 biner: 00000101. Invert bit: 11111010. Tambah 1: 11111011."},
        {"q": "Berapakah nilai desimal dari bilangan biner 1101?", "a": "13 (8 + 4 + 0 + 1 = 13)."}
    ],
    "OR_02_GERBANG_LOGIKA": [
        {"q": "Apa karakteristik utama dari gerbang logika XOR?", "a": "Output bernilai 1 jika dan hanya jika input-inputnya memiliki nilai logika yang berbeda."}
    ],
    "SD_01_INTRO_BIGO": [
        {"q": "Berapa kompleksitas waktu (Big O) dari algoritma Binary Search?", "a": "O(log n) karena data terus dibagi dua pada setiap langkah pencarian."},
        {"q": "Mana yang lebih cepat antara O(n log n) dan O(n^2) untuk data besar?", "a": "O(n log n) jauh lebih cepat dan efisien dibandingkan O(n^2)."}
    ],
    "SD_03_LINKED_LIST": [
        {"q": "Apa keunggulan Linked List dibandingkan dengan Array konvensional?", "a": "Alokasi memori dinamis (fleksibel) dan proses insert/delete elemen lebih efisien (O(1)) tanpa menggeser elemen lain."},
        {"q": "Apa fungsi dari pointer 'Next' pada simpul (Node) Linked List?", "a": "Menyimpan alamat memori simpul berikutnya dalam rantai Linked List."}
    ],
    "SD_06_TREE_BST": [
        {"q": "Apa sifat utama dari BST (Binary Search Tree)?", "a": "Nilai semua node di anak kiri selalu lebih kecil dari node induk, dan nilai semua node di anak kanan selalu lebih besar dari node induk."},
        {"q": "Urutan penelusuran (traversal) apa yang menghasilkan output data BST terurut?", "a": "Inorder traversal (Kiri - Induk - Kanan)."}
    ]
}

def get_flashcards(topic_id: str):
    return FLASHCARDS_DB.get(topic_id, [
        {"q": f"Explain the main principle of '{topic_id}'?", "a": "The core principles of this topic can be explored interactively with the Smart AI AI Tutor in the chat."},
        {"q": f"How is the concept of '{topic_id}' applied in practice?", "a": "Try practice exercises, quizzes, or ask for implementation examples in the chat room."}
    ])

# ─── Helper: Memuat Silabus & NetworkX DAG ───
def load_syllabus_graph(course_name: str):
    filename = {
        "Database": "praktikum_database.json",
        "Orarkom": "praktikum_orarkom.json",
        "Struktur Data": "praktikum_strukdat.json"
    }.get(course_name)

    if not filename:
        return None, []

    paths = [
        os.path.join("silabus", filename),
        os.path.join("..", "silabus", filename),
        os.path.join("AI-LearningPath", "silabus", filename),
        filename
    ]

    syllabus_data = []
    for path in paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    syllabus_data = json.load(f)
                break
            except Exception as e:
                print(f"Error reading syllabus file {path}: {e}")

    if not syllabus_data:
        return None, []

    G = nx.DiGraph()
    for topic in syllabus_data:
        G.add_node(topic["id"], **topic)

    for topic in syllabus_data:
        for prereq in topic.get("prerequisites", []):
            if G.has_node(prereq):
                G.add_edge(prereq, topic["id"])

    return G, syllabus_data

# ─── Helper: Rekomendasi Topik Selanjutnya ───
def get_next_topic(session: UserSession):
    if not session.graph:
        return None

    if session.override_active and session.override_node:
        override_id = session.override_node
        for topic in session.syllabus:
            if topic["id"] == override_id:
                return topic

    for topic in session.syllabus:
        tid = topic["id"]
        if session.mastery.get(tid, 0.0) >= 0.8:
            continue

        prereqs = list(session.graph.predecessors(tid))
        all_prereqs_met = True
        for p in prereqs:
            if session.mastery.get(p, 0.0) < 0.8:
                all_prereqs_met = False
                break

        if all_prereqs_met:
            return topic

    return None

# ─── Helper: Pelacakan Kognitif BKT (Bayesian Knowledge Tracing) ───
def update_bkt(current_mastery: float, is_correct: bool) -> float:
    p_learn = 0.20
    p_guess = 0.25
    p_slip = 0.10

    if is_correct:
        numerator = current_mastery * (1 - p_slip)
        denominator = numerator + (1 - current_mastery) * p_guess
    else:
        numerator = current_mastery * p_slip
        denominator = numerator + (1 - current_mastery) * (1 - p_guess)

    p_known_given_obs = numerator / (denominator if denominator > 0 else 1)
    new_mastery = p_known_given_obs + (1 - p_known_given_obs) * p_learn
    return max(0.01, min(0.99, new_mastery))

# ─── Helper: Penjadwalan Spaced Repetition (SM-2 Algorithm) ───
def update_sm2(card_state: dict, rating: int) -> dict:
    interval = card_state.get("interval", 1)
    ease_factor = card_state.get("ease_factor", 2.5)
    repetitions = card_state.get("repetitions", 0)

    if rating >= 3:
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = int(interval * ease_factor)
        repetitions += 1
    else:
        repetitions = 0
        interval = 1

    q_map = {1: 1, 2: 3, 3: 4, 4: 5}
    q = q_map.get(rating, 4)
    ease_factor = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    ease_factor = max(1.3, ease_factor)

    return {"interval": interval, "ease_factor": ease_factor, "repetitions": repetitions}

# ─── Helper: Parsing Course & Learning Style Selection ───
def parse_initial_selection(msg_text: str):
    msg_lower = msg_text.lower()
    course = None
    style = None

    # Use word-boundary matching to avoid false positives
    # e.g. "a" should NOT match inside "maybe" or "database"
    def has_word(text, word):
        return bool(re.search(r'\b' + re.escape(word) + r'\b', text))

    if any(has_word(msg_lower, k) for k in ["database", "basis data", "db", "sql", "1"]):
        course = "Database"
    elif any(has_word(msg_lower, k) for k in ["orarkom", "organisasi", "cpu", "gerbang", "assembly", "2"]):
        course = "Orarkom"
    elif any(has_word(msg_lower, k) for k in ["struktur data", "strukdat", "data structure", "binary tree", "linked list", "stack", "queue", "graph", "3"]):
        course = "Struktur Data"

    if any(has_word(msg_lower, k) for k in ["visual", "interactive", "interaktif", "diagram", "a"]):
        style = "Visual"
    elif any(has_word(msg_lower, k) for k in ["auditory", "auditorial", "smart AI", "dialogue", "dialog", "tanya", "b"]):
        style = "Auditorial"
    elif any(has_word(msg_lower, k) for k in ["practical", "praktikal", "coding", "koding", "code", "praktek", "latihan", "c"]):
        style = "Praktikal"

    return course, style

# ─── Helper: Membuat System Instruction Gemini ───
def get_system_instruction(course: str, learning_style: str, current_node: dict, mastery: float, remedial_attempts: int):
    node_name = current_node.get("name", "Unknown Topic")
    node_desc = current_node.get("description", "No description available")
    
    instruction = (
        "You are the 'Smart AI Tutor', an intelligent, empathetic, and interactive instructor for the AI Learning Path platform.\n"
        "CRITICAL RULE: You MUST communicate exclusively in English at all times, regardless of the language the student uses.\n\n"
        "--- CURRENT CONTEXT (RAG) ---\n"
        f"Course: {course}\n"
        f"Current Topic: {node_name}\n"
        f"Topic Description: {node_desc}\n"
        f"Student Mastery Level: {mastery:.0%} (Target mastery to pass is 80%)\n\n"

        "--- YOUR MAIN TASKS AS A TUTOR ---\n"
        "1. Teach the material interactively. Do not give long lectures! Provide explanations in 2-3 paragraphs maximum.\n"
        "2. At the end of your explanation, you MUST provide 1 QUIZ QUESTION or PRACTICAL CHALLENGE to test the student's understanding of the topic.\n"
        "3. Wait for the student to answer the quiz, then evaluate their answer.\n\n"

        "--- ETHICS & SMART AI GUARDRAILS ---\n"
        "1. NEVER provide raw code answers or final solutions. Let the student think independently.\n"
        "2. If the student asks for a direct answer, provide a *hint*, *pseudocode*, or step-by-step guidance.\n\n"
    )

    if learning_style == "Visual":
        instruction += (
            "--- LEARNING STYLE: VISUAL & INTERACTIVE ---\n"
            "- Use visual representations such as text flowcharts, markdown tables, or ASCII diagrams to explain concepts.\n"
            "- Create creative visualizations of memory, circuits, or table relations (e.g., [Node A] -> [Node B]).\n\n"
        )
    elif learning_style == "Auditorial":
        instruction += (
            "--- LEARNING STYLE: AUDITORY & DISCUSSION ---\n"
            "- Use a highly interactive conversational tone, as if you are speaking directly to them.\n"
            "- Use real-world analogies to explain abstract concepts.\n\n"
        )
    elif learning_style == "Praktikal":
        instruction += (
            "--- LEARNING STYLE: PRACTICAL & CODING ---\n"
            "- Focus your explanation on real-world applications and best practices.\n"
            "- Provide incomplete code snippets (fill-in-the-blanks) or ask them to find a *bug* in the code.\n\n"
        )

    if remedial_attempts >= 2:
        instruction += (
            "--- ACTIVE REMEDIAL INTERVENTION ---\n"
            "This student has failed the quiz more than 2 consecutive times on this topic.\n"
            "- Simplify your language and lower the difficulty of the quiz question.\n"
            "- Provide the most basic analogies and extra motivation so they don't give up.\n\n"
        )

    instruction += (
        "--- COGNITIVE EVALUATION & BKT UPDATE (EXTREMELY CRITICAL!) ---\n"
        "The system relies on you to track the student's mastery so the syllabus can progress. At the VERY END of every response, you MUST append exactly ONE of the following secret tags on a new line:\n\n"
        "- If the student JUST ANSWERED your quiz/challenge CORRECTLY (understands the concept):\n"
        "  Use tag: `[BKT_UPDATE: CORRECT]`\n\n"
        "- If the student ATTEMPTED the quiz but was INCORRECT (or still doesn't grasp the core concept):\n"
        "  Use tag: `[BKT_UPDATE: INCORRECT]`\n\n"
        "- If the current interaction is JUST an explanation, a general question, or you just asked a question (and the student hasn't answered yet):\n"
        "  Use tag: `[STATUS: LEARNING]`\n\n"
        "WARNING: Do not forget this tag at the last line of your response, and ensure exact spelling (using square brackets)."
    )
    return instruction

def simulate_ai_response(prompt: str) -> str:
    prompt_lower = prompt.lower()
    
    if any(k in prompt_lower for k in ["give up", "quit", "dropout", "menyerah", "berhenti"]):
        return (
            "⚠️ [System Intervention]\n"
            "I understand this might feel tough. Based on the data, many students struggle at this stage "
            "but succeed after reviewing the practicum quizzes. "
            "Would you like to try an easier exercise first to rebuild your confidence?"
        )
    
    if any(k in prompt_lower for k in ["answer", "code", "solution", "jawaban", "kodingan", "buatkan"]):
        return (
            "🔍 [Smart AI Guardrail]\n"
            "As an AI Tutor, I can't give direct code answers to protect academic integrity.\n"
            "But I can give you hints. Try thinking about:\n"
            "1. What input parameters are needed?\n"
            "2. What are the edge cases for this algorithm?\n"
            "Write a code snippet first and share it with me for evaluation!\n\n"
            "[BKT_UPDATE: INCORRECT]"
        )
        
    if any(k in prompt_lower for k in ["correct", "done", "finished", "benar", "selesai", "berhasil"]):
        return (
            "🎉 Great job! Your answer or analysis is spot on. You've successfully mastered this part of the concept.\n\n"
            "Let's move on to the next sub-topic or try a new challenge. Are you ready?\n\n"
            "[BKT_UPDATE: CORRECT]"
        )
        
    return (
        "Interesting! Let's explore this concept further using your chosen learning style.\n"
        "Is there any part of the previous explanation you'd like to discuss further?"
    )

# ─── Helper: Memanggil Real Gemini API ───
def generate_ai_response(system_instruction: str, prompt: str, history=None) -> str:
    import os
    # Kumpulkan semua API Key dari environment
    api_keys = []
    base_key = os.environ.get("GEMINI_API_KEY")
    if base_key and base_key.strip() != "":
        api_keys.append(base_key.strip())
    
    for i in range(1, 11):
        k = os.environ.get(f"GEMINI_API_KEY_{i}")
        if k and k.strip() != "" and k.strip() not in api_keys:
            api_keys.append(k.strip())
            
    if not api_keys:
        return "⚠️ **API key error.**\n\nTidak ada Gemini API Key yang ditemukan di `.env`."

    import random
    random.shuffle(api_keys)

    MODELS = [
        ("gemini-2.5-flash",    "v1beta"),
        ("gemini-1.5-flash",    "v1"),
        ("gemini-1.5-pro",      "v1"),
    ]

    contents = []
    if history:
        for msg in history[-10:]:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg["content"])]
            ))
    contents.append(types.Content(
        role="user",
        parts=[types.Part.from_text(text=prompt)]
    ))

    last_error = None
    for api_key in api_keys:
        for model_name, api_version in MODELS:
            try:
                client = genai.Client(
                    api_key=api_key,
                    http_options={"api_version": api_version}
                )

                if api_version == "v1beta":
                    config = types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.7,
                    )
                    model_contents = contents
                else:
                    config = types.GenerateContentConfig(temperature=0.7)
                    system_turn = types.Content(
                        role="user",
                        parts=[types.Part.from_text(
                            text=f"[System Instructions — follow these throughout the conversation]\n{system_instruction}"
                        )]
                    )
                    ack_turn = types.Content(
                        role="model",
                        parts=[types.Part.from_text(text="Understood. I will follow these instructions throughout our conversation.")]
                    )
                    model_contents = [system_turn, ack_turn] + contents

                response = client.models.generate_content(
                    model=model_name,
                    contents=model_contents,
                    config=config
                )
                if model_name != "gemini-2.5-flash":
                    print(f"[Cascade] Using fallback model: {model_name}")
                return response.text
            except Exception as e:
                err_str = str(e)
                print(f"Gemini API Error [{model_name}] dengan kunci tertentu: {e}")
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "404" in err_str or "NOT_FOUND" in err_str or "503" in err_str:
                    last_error = e
                    continue # Lanjut ke model berikutnya, atau ke key berikutnya jika model habis
                
                last_error = e
                break # Hard error (auth/network), stop looping model
        else:
            # Jika loop model habis karena Resource Exhausted/404, lanjut ke API KEY berikutnya
            print("Beralih ke API Key cadangan berikutnya...")
            continue
            
        # Jika loop break (Hard error), hentikan pencarian key juga
        break

    err_str = str(last_error) if last_error else ""
    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
        return (
            "⚠️ **Sistem sedang mengalami antrean tinggi (High Demand).**\n\n"
            "Semua kunci cadangan API telah mencapai batas maksimal (Rate Limit). Harap tunggu sekitar 1 menit lalu coba lagi."
        )
    elif "503" in err_str or "UNAVAILABLE" in err_str:
        return "⚠️ **Server AI sedang kelebihan beban.**\n\nSilakan coba lagi dalam beberapa detik."
    elif "401" in err_str or "API_KEY" in err_str:
        return "⚠️ **Error API Key.**\n\nKonfigurasi API Key ditolak. Periksa kembali file `.env` Anda."
    else:
        return "⚠️ **Terjadi kesalahan saat menghubungi AI.**\n\nSilakan coba lagi sebentar lagi."



# ─── Endpoint: Root & Health ───
@app.get("/")
def read_root():
    return {"status": "ok", "message": "AI Learning Path Backend API is running!"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

# ─── Endpoint: Reset Session ───
@app.post("/api/reset")
def reset_session(request: Request, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    session_id = request.headers.get("X-Session-ID", "default_session")
    registry_key = f"{user_id}_{session_id}"
    session_registry[registry_key] = {
        "session_state": UserSession(),
        "chat_history": []
    }
    save_session_to_db(user_id, session_id)
    return {"status": "ok", "message": f"Session '{session_id}' has been reset."}

# ─── Endpoint: Delete Session ───
@app.delete("/api/session")
def delete_session(request: Request, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    session_id = request.headers.get("X-Session-ID", "default_session")
    registry_key = f"{user_id}_{session_id}"
    
    if registry_key in session_registry:
        del session_registry[registry_key]
        
    if supabase_client:
        try:
            supabase_client.table("user_sessions")\
                .delete()\
                .eq("user_id", user_id)\
                .eq("session_id", session_id)\
                .execute()
            return {"status": "ok", "message": f"Session '{session_id}' has been deleted."}
        except Exception as e:
            print(f"[Supabase Error] Delete session failed: {e}")
            raise HTTPException(status_code=500, detail="Gagal menghapus sesi dari database")
            
    return {"status": "not_found", "message": f"Session '{session_id}' not found."}


# ─── Endpoint: Ambil Kemajuan Siswa (Real-time untuk Jalur Silabus) ───
@app.get("/api/progress")
def get_progress(request: Request, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    session_id = request.headers.get("X-Session-ID", "default_session")
    session, _ = get_session(user_id, session_id)
    
    if not session.course:
        return {"configured": False}
        
    return {
        "configured": True,
        "course": session.course,
        "learning_style": session.learning_style,
        "current_node": session.current_node,
        "mastery": session.mastery,
        "fsrs_cards": session.fsrs_cards,
        "remedial_attempts": session.remedial_attempts,
        "syllabus": session.syllabus
    }

# ─── Endpoint: List Semua Sesi Pengguna (Cross-Device Sync) ───
@app.get("/api/sessions")
def get_all_sessions(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    if not supabase_client:
        return {"sessions": []}
        
    try:
        response = supabase_client.table("user_sessions")\
            .select("session_id, chat_history, updated_at")\
            .eq("user_id", user_id)\
            .order("updated_at", desc=True)\
            .execute()
        
        sessions = []
        for row in response.data:
            chat_history = row.get("chat_history", [])
            
            # Extract title from first user message
            title = ""
            for msg in chat_history:
                if msg.get("role") == "user":
                    content = msg.get("content", "")
                    title = content[:40] if content else "Attachment"
                    break
            
            # Konversi updated_at (ISO) ke ms timestamp untuk frontend
            updated_str = row.get("updated_at")
            updated_ms = int(time.time() * 1000)
            if updated_str:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(updated_str.replace("Z", "+00:00"))
                    updated_ms = int(dt.timestamp() * 1000)
                except Exception:
                    pass

            sessions.append({
                "id": row.get("session_id"),
                "title": title,
                "messages": chat_history,
                "updatedAt": updated_ms
            })
            
        return {"sessions": sessions}
    except Exception as e:
        print(f"[Supabase Error] List sessions failed: {e}")
        return {"sessions": []}

# ─── Endpoint: Ambil Flashcards per Topik ───
@app.get("/api/flashcards")
def get_topic_flashcards(topic_id: str):
    cards = get_flashcards(topic_id)
    return {"topic_id": topic_id, "cards": cards}

# ─── Endpoint: Submit Rating Flashcards SM-2 ───
class ReviewRequest(BaseModel):
    topic_id: str
    rating: int

@app.post("/api/flashcard/review")
def review_flashcard(req: ReviewRequest, request: Request, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    session_id = request.headers.get("X-Session-ID", "default_session")
    session, _ = get_session(user_id, session_id)
    
    if req.topic_id not in session.mastery:
        session.mastery[req.topic_id] = 0.5
        
    card = session.fsrs_cards.get(req.topic_id, {"interval": 1, "ease_factor": 2.5, "repetitions": 0})
    new_card = update_sm2(card, req.rating)
    session.fsrs_cards[req.topic_id] = new_card
    
    # Berikan dampak rating review ke Mastery BKT
    if req.rating >= 3:
        old_m = session.mastery.get(req.topic_id, 0.5)
        session.mastery[req.topic_id] = min(0.99, old_m + 0.05)
    else:
        old_m = session.mastery.get(req.topic_id, 0.5)
        session.mastery[req.topic_id] = max(0.01, old_m - 0.10)
        
    save_session_to_db(user_id, session_id)
        
    return {
        "status": "ok",
        "message": "FSRS SM-2 state updated",
        "card": new_card,
        "mastery": session.mastery[req.topic_id]
    }

# ─── Endpoint: Chat API (Mendukung JSON dan Multipart/Form) ───
@app.post("/api/chat")
async def chat_with_ai(
    request: Request,
    message: str = Form(None),
    file: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    content_type = request.headers.get("content-type", "")
    
    # 1. Parsing Input (JSON vs Form Data)
    if "application/json" in content_type:
        try:
            body = await request.json()
            user_message = body.get("message", "")
        except Exception:
            raise HTTPException(status_code=400, detail="JSON body tidak valid.")
    else:
        user_message = message

    if not user_message:
        raise HTTPException(status_code=400, detail="Pesan (message) wajib diisi.")

    # Ambil Session ID dari headers
    session_id = request.headers.get("X-Session-ID", "default_session")
    registry_key = f"{user_id}_{session_id}"
    session, chat_history = get_session(user_id, session_id)

    # 2. Intersep Command Reset
    if user_message.strip().lower() == "/reset":
        if registry_key in session_registry:
            session_registry[registry_key] = {
                "session_state": UserSession(),
                "chat_history": []
            }
        save_session_to_db(user_id, session_id)
        reply = "🔄 **Sesi belajar telah di-reset.** Silakan pilih kembali mata kuliah dan gaya belajar Anda dengan mengirimkan pesan baru."
        return _build_response(reply, None, None, None, None)

    # 3. Handle File Upload (jika dikirim lewat Form Data)
    file_url = None
    file_name = None
    file_size = None
    file_type = None
    file_content_str = ""

    if file and file.filename:
        ext = os.path.splitext(file.filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        base_url = str(request.base_url).rstrip("/")
        file_url = f"{base_url}/uploads/{unique_name}"
        file_name = file.filename
        file_size = os.path.getsize(file_path)
        file_type = file.content_type or "application/octet-stream"

        if ext.lower() in [".txt", ".py", ".json", ".js", ".ts", ".html", ".css", ".md", ".csv", ".ipynb", ".xml"]:
            try:
                file.file.seek(0)
                content = await file.read()
                file_content_str = f"\n\n[Siswa mengunggah file teks '{file.filename}']\nIsi file:\n```\n{content.decode('utf-8', errors='ignore')}\n```"
            except Exception as e:
                print(f"Error reading text file: {e}")

    # 4. Deteksi Profil Pengguna Baru
    if session.course is None or session.learning_style is None:
        detected_course, detected_style = parse_initial_selection(user_message)
        
        if detected_course:
            session.course = detected_course
        if detected_style:
            session.learning_style = detected_style

        if session.course and session.learning_style:
            G, syllabus_data = load_syllabus_graph(session.course)
            if G:
                session.graph = G
                session.syllabus = syllabus_data
                session.mastery = {topic["id"]: 0.15 for topic in syllabus_data}
                session.fsrs_cards = {}
                session.remedial_attempts = 0
                session.override_active = False
                session.current_node = get_next_topic(session)

                course_title = session.course

                style_title = {
                    "Visual": "Visual & Interactive",
                    "Auditorial": "Auditory & Smart AI Dialogue",
                    "Praktikal": "Practical & Coding-Focused"
                }[session.learning_style]

                reply = (
                    f"🎉 **Learning Profile Created!**\n\n"
                    f"• **Course:** {course_title}\n"
                    f"• **Learning Style:** {style_title}\n\n"
                    f"Let's get started! Your first topic is **{session.current_node['name']}**.\n"
                    f"Description: {session.current_node['description']}\n\n"
                    "Are you ready to start learning this concept? Say 'Ready' to begin!"
                )
                chat_history.append({"role": "user", "content": user_message})
                chat_history.append({"role": "bot", "content": reply})
                save_session_to_db(user_id, session_id)
                return _build_response(reply, file_url, file_name, file_size, file_type)
            else:
                session.course = None
                session.learning_style = None
                reply = "⚠️ Error loading syllabus. Please retype your selection."
                return _build_response(reply, file_url, file_name, file_size, file_type)

        if session.course is None and session.learning_style is None:
            reply = (
                "Hello! Welcome to **AI Learning Path**.\n"
                "Before we begin, please select the **Course** you want to study and your preferred **Learning Style**:\n\n"
                "**Course Options:**\n"
                "1. **Database**\n"
                "2. **Computer Organization & Architecture (Orarkom)**\n"
                "3. **Data Structures**\n\n"
                "**Learning Style Options:**\n"
                "*   **A. Visual & Interactive**: Uses concept visualizations, ASCII diagrams, and flowcharts.\n"
                "*   **B. Auditory & Smart AI Dialogue**: Uses guided Q&A discussion to develop your understanding.\n"
                "*   **C. Practical & Coding-Focused**: Uses code snippets, hands-on exercises, and pseudocode.\n\n"
                "*You can reply like this: **'1 and A'** or **'Data Structures with Smart AI style'**.*"
            )
        elif session.course is None:
            reply = (
                f"Your learning style has been set to **{session.learning_style}**.\n"
                "Now, please choose the course you want to study:\n\n"
                "1. **Database**\n"
                "2. **Computer Organization & Architecture (Orarkom)**\n"
                "3. **Data Structures**\n\n"
                "*Reply with **1**, **2**, or **3**.*"
            )
        else:
            reply = (
                f"Your course has been set to **{session.course}**.\n"
                "Now, please choose your preferred learning style:\n\n"
                "*   **A. Visual & Interactive**: Uses concept visualizations, ASCII diagrams, and flowcharts.\n"
                "*   **B. Auditory & Smart AI Dialogue**: Uses guided Q&A discussion to develop your understanding.\n"
                "*   **C. Practical & Coding-Focused**: Uses code snippets, hands-on exercises, and pseudocode.\n\n"
                "*Reply with **A**, **B**, or **C**.*"
            )
        save_session_to_db(user_id, session_id)
        return _build_response(reply, file_url, file_name, file_size, file_type)

    # 5. Percakapan Utama dengan Gemini API
    current_node = session.current_node
    mastery = session.mastery.get(current_node["id"], 0.15)
    
    system_instruction = get_system_instruction(
        course=session.course,
        learning_style=session.learning_style,
        current_node=current_node,
        mastery=mastery,
        remedial_attempts=session.remedial_attempts
    )
    
    prompt = user_message + file_content_str
    
    ai_raw_reply = generate_ai_response(
        system_instruction=system_instruction,
        prompt=prompt,
        history=chat_history
    )
    
    # 6. Parse Tag Update Kognitif (BKT & SM-2)
    is_correct = None
    if "[BKT_UPDATE: CORRECT]" in ai_raw_reply:
        is_correct = True
        ai_reply = ai_raw_reply.replace("[BKT_UPDATE: CORRECT]", "").strip()
    elif "[BKT_UPDATE: INCORRECT]" in ai_raw_reply:
        is_correct = False
        ai_reply = ai_raw_reply.replace("[BKT_UPDATE: INCORRECT]", "").strip()
    else:
        ai_reply = ai_raw_reply.strip()

    # Eksekusi Update Cognitive State
    if is_correct is not None:
        old_mastery = session.mastery.get(current_node["id"], 0.15)
        new_mastery = update_bkt(old_mastery, is_correct)
        session.mastery[current_node["id"]] = new_mastery
        
        # SM-2 Update
        card = session.fsrs_cards.get(current_node["id"], {"interval": 1, "ease_factor": 2.5, "repetitions": 0})
        rating = 3 if is_correct else 1
        new_card = update_sm2(card, rating)
        session.fsrs_cards[current_node["id"]] = new_card
        
        if not is_correct:
            session.remedial_attempts += 1
            # UPGRADE 1: DETEKSI REMEDIAL LOOP & RESTRUKTURISASI GRAPH DINAMIS
            if session.remedial_attempts >= 2 and not current_node.get("is_remedial", False):
                rem_node_id = f"{current_node['id']}_REM_PRACTICE"
                node_exists = any(t["id"] == rem_node_id for t in session.syllabus)
                
                if not node_exists:
                    # Ambil prasyarat asli dari node induk
                    original_prereqs = list(current_node.get("prerequisites", []))
                    
                    rem_node = {
                        "id": rem_node_id,
                        "name": f"Reinforcement Practice: {current_node['name']}",
                        "description": f"Focused and simplified reinforcement material to solidify your understanding of '{current_node['name']}' before moving forward.",
                        "difficulty": max(0.1, round(current_node.get("difficulty", 0.5) - 0.2, 2)),
                        "est_minutes": 25,
                        "prerequisites": original_prereqs,
                        "is_remedial": True,
                        "parent_node_id": current_node["id"]
                    }
                    
                    # Sisipkan remedial node tepat sebelum node induk di syllabus
                    current_idx = next(i for i, t in enumerate(session.syllabus) if t["id"] == current_node["id"])
                    session.syllabus.insert(current_idx, rem_node)
                    
                    # Tambah remedial node ke NetworkX Graph
                    session.graph.add_node(rem_node_id, **rem_node)
                    
                    # Hubungkan prereqs asli ke remedial node, dan hapus hubungan langsung ke node induk
                    for p in original_prereqs:
                        if session.graph.has_node(p):
                            session.graph.add_edge(p, rem_node_id)
                            if session.graph.has_edge(p, current_node["id"]):
                                session.graph.remove_edge(p, current_node["id"])
                                
                    # Hubungkan remedial node ke node induk
                    session.graph.add_edge(rem_node_id, current_node["id"])
                    
                    # Update prerequisites list di syllabus metadata
                    for topic in session.syllabus:
                        if topic["id"] == current_node["id"]:
                            topic["prerequisites"] = [rem_node_id]
                            break
                            
                    session.mastery[rem_node_id] = 0.35
                    
                # Alihkan secara dinamis
                for topic in session.syllabus:
                    if topic["id"] == rem_node_id:
                        session.current_node = topic
                        session.mastery[rem_node_id] = 0.35  # Reset agar mereka harus mengulangnya jika dialihkan kembali
                        break
                session.remedial_attempts = 0
                ai_reply += (
                    f"\n\n⚠️ **[Jalur Belajar Direkayasa Ulang]**\n"
                    f"Sistem mendeteksi Anda mengalami hambatan berulang. AI menyisipkan materi latihan khusus: "
                    f"**{session.current_node['name']}**.\n"
                    f"Mari kita perkuat dasar pemahaman Anda pada latihan ini terlebih dahulu!"
                )
        else:
            session.remedial_attempts = 0
            
            # Jika lulus materi
            if new_mastery >= 0.8:
                next_node = get_next_topic(session)
                if next_node:
                    session.current_node = next_node
                    session.remedial_attempts = 0
                    session.override_active = False
                    ai_reply += (
                        f"\n\n🎉 **Selamat!** Anda telah menguasai topik **{current_node['name']}** dengan tingkat penguasaan kognitif {new_mastery:.0%}.\n"
                        f"Mari lanjut ke topik berikutnya: **{next_node['name']}**.\n"
                        f"Deskripsi: {next_node['description']}"
                    )
                else:
                    ai_reply += (
                        f"\n\n🏆 **Outstanding!** You have successfully mastered all topics in **{session.course}**! "
                        "The entire syllabus has been completed. You can review any topic anytime or choose a new course by typing **/reset**."
                    )

    # 7. Save chat history & persist session to DB
    chat_history.append({"role": "user", "content": user_message})
    chat_history.append({"role": "bot", "content": ai_reply})
    save_session_to_db(user_id, session_id)

    return _build_response(ai_reply, file_url, file_name, file_size, file_type)

def _build_response(reply: str, file_url, file_name, file_size, file_type):
    response = {"reply": reply}
    if file_url:
        response["file_url"] = file_url
        response["file_name"] = file_name
        response["file_size"] = file_size
        response["file_type"] = file_type
    return response


# ─── Endpoint: Hapus Akun Pengguna ───
@app.delete("/api/delete-account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500, 
            detail="Koneksi admin database (Supabase URL atau Service Role Key) belum dikonfigurasi di server."
        )
        
    import httpx
    
    # API Admin Supabase Auth untuk menghapus user
    url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "apikey": SERVICE_ROLE_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(url, headers=headers)
        
        if response.status_code != 200:
            print(f"[Supabase Error] Gagal hapus user {user_id}: Status {response.status_code}, Body: {response.text}")
            raise HTTPException(status_code=400, detail="Gagal menghapus akun pengguna dari Supabase.")
            
        # Bersihkan memori registry sesi untuk user ini
        keys_to_delete = [k for k in session_registry.keys() if k.startswith(f"{user_id}_")]
        for k in keys_to_delete:
            del session_registry[k]
            
        return {"status": "ok", "message": "Akun Anda beserta semua data belajar telah berhasil dihapus permanen."}
        
    except Exception as e:
        print(f"[Delete Account Error] {e}")
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan saat menghapus akun: {str(e)}")
