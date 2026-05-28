import os
import shutil
import uuid
import json
import time
import networkx as nx
from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from google import genai
from google.genai import types

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

# ─── Buat folder uploads jika belum ada ───
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
        {"q": f"Jelaskan prinsip utama konsep '{topic_id}'?", "a": "Prinsip utama materi ini dapat dipelajari secara interaktif bersama Socratic AI Tutor di ruang chat."},
        {"q": f"Bagaimana penerapan konsep '{topic_id}'?", "a": "Anda dapat mencoba latihan pemrograman, kuis, atau menanyakan contoh implementasi di ruang obrolan."}
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

# ─── Helper: Parsing Pemilihan Profil & Gaya Belajar ───
def parse_initial_selection(msg_text: str):
    msg_lower = msg_text.lower()
    course = None
    style = None

    if any(k in msg_lower for k in ["database", "basis data", "db", "sql", "1"]):
        course = "Database"
    elif any(k in msg_lower for k in ["orarkom", "organisasi", "cpu", "gerbang", "assembly", "2"]):
        course = "Orarkom"
    elif any(k in msg_lower for k in ["struktur data", "strukdat", "binary tree", "linked list", "stack", "queue", "graph", "3"]):
        course = "Struktur Data"

    if any(k in msg_lower for k in ["visual", "interaktif", "diagram", "gambar", "a"]):
        style = "Visual"
    elif any(k in msg_lower for k in ["auditorial", "socratic", "tanya", "dialog", "b"]):
        style = "Auditorial"
    elif any(k in msg_lower for k in ["praktikal", "koding", "praktek", "code", "coding", "latihan", "c"]):
        style = "Praktikal"

    return course, style

# ─── Helper: Membuat System Instruction Gemini ───
def get_system_instruction(course: str, learning_style: str, current_node: dict, mastery: float, remedial_attempts: int):
    node_name = current_node.get("name", "Topik Tidak Diketahui")
    node_desc = current_node.get("description", "Tidak ada deskripsi")

    instruction = (
        "Anda adalah AI Socratic Tutor yang cerdas, empatik, dan interaktif untuk platform pembelajaran adaptif.\n"
        f"Mata Kuliah: {course}\n"
        f"Topik saat ini: {node_name}\n"
        f"Deskripsi Topik: {node_desc}\n"
        f"Probabilitas Penguasaan Kognitif Siswa pada topik ini: {mastery:.0%}\n\n"

        "--- ATURAN ETIKA & TUTORING (SOCRATIC GUARDRAIL) ---\n"
        "1. JANGAN PERNAH memberikan jawaban coding langsung atau solusi mentah yang bisa di copy-paste oleh siswa.\n"
        "2. Jika siswa meminta jawaban atau kode lengkap, tolak dengan sopan dan bimbing mereka langkah-demi-langkah menggunakan pertanyaan Socratic.\n"
        "3. Tanyakan pemahaman awal mereka, berikan potongan pseudocode atau petunjuk kecil (hints), dan minta mereka menulis kodenya sendiri.\n"
        "4. Selalu evaluasi jawaban siswa secara kritis namun konstruktif.\n\n"
    )

    if learning_style == "Visual":
        instruction += (
            "--- GAYA BELAJAR: VISUAL & INTERAKTIF ---\n"
            "- Gunakan representasi visual seperti diagram alur teks, tabel markdown, atau diagram ASCII untuk menjelaskan konsep.\n"
            "- Buat visualisasi hierarki memori, rangkaian, pointer, atau database relations secara visual menggunakan karakter teks (misalnya, [Node A] -> [Node B]).\n"
            "- Sajikan ringkasan terstruktur dengan format bullet points yang rapi.\n\n"
        )
    elif learning_style == "Auditorial":
        instruction += (
            "--- GAYA BELAJAR: AUDITORIAL & SOCRATIC DIALOGUE ---\n"
            "- Gunakan nada percakapan yang sangat interaktif dan dialogis, seolah-olah Anda adalah tutor pribadi yang sedang berbicara langsung.\n"
            "- Gunakan analogi dunia nyata untuk menjelaskan konsep abstrak.\n"
            "- Akhiri penjelasan Anda dengan pertanyaan pemantik diskusi yang membimbing siswa menemukan jawabannya sendiri.\n\n"
        )
    elif learning_style == "Praktikal":
        instruction += (
            "--- GAYA BELAJAR: PRAKTIKAL & FOKUS KODING ---\n"
            "- Berikan tantangan praktis kecil (mini-coding challenges) yang relevan dengan topik.\n"
            "- Sediakan cuplikan sintaks kosong/setengah selesai (fill-in-the-blanks code templates) atau minta mereka mendebug baris kode yang rusak.\n"
            "- Fokuskan penjelasan pada penerapan praktis di dunia nyata.\n\n"
        )

    if remedial_attempts >= 2:
        instruction += (
            "--- PENYISIPAN TANTANGAN (CHALLENGE INJECTION) ---\n"
            "Siswa terdeteksi berada di Remedial Loop (gagal memahami kuis/latihan berkali-kali).\n"
            "Untuk mencegah frustrasi:\n"
            "- Sederhanakan bahasa Anda dan tawarkan sub-topik alternatif yang lebih mudah.\n"
            "- Berikan analogi yang lebih sederhana.\n"
            "- Berikan saran untuk berkonsultasi dengan Asisten Praktikum.\n"
            "- Jika mereka mengalami kebuntuan total pada koding, berikan mereka tantangan visual/alternatif yang menyegarkan.\n\n"
        )

    instruction += (
        "--- EVALUASI KOGNITIF & BKT UPDATE ---\n"
        "Evaluasi apakah interaksi/jawaban siswa menunjukkan bahwa mereka berhasil menjawab kuis/pertanyaan latihan dengan BENAR atau SALAH.\n"
        "Di bagian akhir respon Anda, Anda HARUS menyisipkan salah satu tag rahasia berikut (pisahkan dengan baris baru):\n"
        "- Jika siswa berhasil menjawab pertanyaan latihan/kuis dengan BENAR dan menunjukkan pemahaman: ketik `[BKT_UPDATE: CORRECT]`\n"
        "- Jika siswa mencoba menjawab pertanyaan latihan/kuis tetapi SALAH atau masih salah paham: ketik `[BKT_UPDATE: INCORRECT]`\n"
        "- Jika siswa hanya bertanya secara umum, berdiskusi biasa, atau belum menjawab kuis: JANGAN sisipkan tag apa pun.\n"
        "Tag ini sangat penting untuk memperbarui status kognitif (Knowledge Tracing) di database backend."
    )
    return instruction

# ─── Helper: Simulasi AI Respons (Fallback jika API Key kosong) ───
def simulate_ai_response(prompt: str) -> str:
    prompt_lower = prompt.lower()
    
    if "ingin berhenti" in prompt_lower or "menyerah" in prompt_lower or "dropout" in prompt_lower:
        return (
            "⚠️ [Intervensi Sistem]\n"
            "Saya mengerti ini mungkin terasa berat. Berdasarkan data, banyak mahasiswa yang "
            "mengalami kesulitan di tahap ini, namun berhasil lulus setelah mengulang kuis "
            "praktikum. Apakah Anda ingin mencoba latihan yang lebih mudah dulu untuk "
            "mengembalikan kepercayaan diri?"
        )
    
    if any(k in prompt_lower for k in ["jawaban", "kodingan", "buatkan", "jawabannya", "minta kode"]):
        return (
            "🔍 [Socratic Guardrail]\n"
            "Sebagai AI Tutor, saya tidak bisa memberikan jawaban kode langsung demi integritas akademik.\n"
            "Namun, saya bisa memberi Anda petunjuk. Cobalah pikirkan:\n"
            "1. Apa parameter input yang dibutuhkan?\n"
            "2. Bagaimana kondisi batas (edge cases) untuk algoritma ini?\n"
            "Coba tuliskan potongan kodenya dahulu dan bagikan ke saya untuk dievaluasi!\n\n"
            "[BKT_UPDATE: INCORRECT]"
        )
        
    if any(k in prompt_lower for k in ["benar", "betul", "selesai", "berhasil", "sudah", "berikutnya"]):
        return (
            "🎉 Bagus sekali! Jawaban atau analisis Anda tepat sekali. Anda telah berhasil menguasai bagian konsep ini.\n\n"
            "Mari kita berlanjut ke submateri berikutnya atau mencoba tantangan baru. Apakah Anda siap?\n\n"
            "[BKT_UPDATE: CORRECT]"
        )
        
    return (
        "Menarik sekali! Mari kita bahas konsep ini lebih dalam menggunakan gaya belajar yang Anda pilih.\n"
        "Apakah ada bagian dari penjelasan sebelumnya yang ingin Anda diskusikan kembali?"
    )

# ─── Helper: Memanggil Real Gemini API ───
def generate_ai_response(system_instruction: str, prompt: str, history=None) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return simulate_ai_response(prompt)

    try:
        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.7,
        )
        
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
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=config
        )
        return response.text
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return f"⚠️ [Sistem: Error Gemini API]\n\nDetail: {str(e)}\n\n(Fallback ke mode simulasi):\n" + simulate_ai_response(prompt)

# ─── Endpoint: Root & Health ───
@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend API AI Learning Path berjalan dengan baik!"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

# ─── Endpoint: Reset Sesi Belajar ───
@app.post("/api/reset")
def reset_session(request: Request):
    session_id = request.headers.get("X-Session-ID", "default_session")
    if session_id in session_registry:
        session_registry[session_id] = {
            "session_state": UserSession(),
            "chat_history": []
        }
    return {"status": "ok", "message": f"Sesi belajar '{session_id}' berhasil di-reset!"}

# ─── Endpoint: Ambil Kemajuan Siswa (Real-time untuk Jalur Silabus) ───
@app.get("/api/progress")
def get_progress(request: Request):
    session_id = request.headers.get("X-Session-ID", "default_session")
    session, _ = get_session(session_id)
    
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
def review_flashcard(req: ReviewRequest, request: Request):
    session_id = request.headers.get("X-Session-ID", "default_session")
    session, _ = get_session(session_id)
    
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
):
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
    session, chat_history = get_session(session_id)

    # 2. Intersep Command Reset
    if user_message.strip().lower() == "/reset":
        if session_id in session_registry:
            session_registry[session_id] = {
                "session_state": UserSession(),
                "chat_history": []
            }
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

        file_url = f"http://localhost:8000/uploads/{unique_name}"
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

                course_title = {
                    "Database": "Sistem Database",
                    "Orarkom": "Organisasi & Arsitektur Komputer (Orarkom)",
                    "Struktur Data": "Struktur Data"
                }[session.course]

                style_title = {
                    "Visual": "Visual & Interaktif",
                    "Auditorial": "Auditorial & Socratic Dialogue",
                    "Praktikal": "Praktikal & Fokus Koding"
                }[session.learning_style]

                reply = (
                    f"🎉 **Profil Belajar Berhasil Dibuat!**\n\n"
                    f"• **Mata Kuliah:** {course_title}\n"
                    f"• **Gaya Belajar:** {style_title}\n\n"
                    f"Mari kita mulai! Topik pertama kita adalah **{session.current_node['name']}**.\n"
                    f"Deskripsi: {session.current_node['description']}\n\n"
                    "Apakah Anda sudah siap untuk mulai mempelajari konsep ini? Katakan 'Siap' untuk memulai!"
                )
                chat_history.append({"role": "user", "content": user_message})
                chat_history.append({"role": "bot", "content": reply})
                return _build_response(reply, file_url, file_name, file_size, file_type)
            else:
                session.course = None
                session.learning_style = None
                reply = "⚠️ Terjadi kesalahan memuat silabus. Silakan ketik ulang pilihan Anda."
                return _build_response(reply, file_url, file_name, file_size, file_type)

        if session.course is None and session.learning_style is None:
            reply = (
                "Halo! Selamat datang di **AI Learning Path**.\n"
                "Sebelum kita mulai, silakan pilih **Mata Kuliah** yang ingin Anda pelajari dan **Gaya Belajar** yang Anda inginkan:\n\n"
                "**Pilihan Mata Kuliah:**\n"
                "1. **Sistem Database**\n"
                "2. **Organisasi dan Arsitektur Komputer (Orarkom)**\n"
                "3. **Struktur Data**\n\n"
                "**Pilihan Gaya Belajar:**\n"
                "*   **A. Visual & Interaktif**: Menggunakan visualisasi konsep, diagram ASCII, dan diagram alur.\n"
                "*   **B. Auditorial & Socratic Dialogue**: Menggunakan diskusi tanya-jawab terarah untuk membimbing pemahaman Anda.\n"
                "*   **C. Praktikal & Fokus Koding**: Menggunakan contoh potongan kode, latihan praktis, dan pseudocode.\n\n"
                "*Format balasan Anda bisa seperti ini: **'1 dan A'** atau **'Struktur Data dengan gaya Socratic'**.*"
            )
        elif session.course is None:
            reply = (
                f"Gaya belajar Anda telah diatur ke **{session.learning_style}**.\n"
                "Sekarang, silakan pilih mata kuliah yang ingin Anda pelajari:\n\n"
                "1. **Sistem Database**\n"
                "2. **Organisasi dan Arsitektur Komputer (Orarkom)**\n"
                "3. **Struktur Data**\n\n"
                "*Balas dengan **1**, **2**, atau **3**.*"
            )
        else:
            reply = (
                f"Mata kuliah Anda telah diatur ke **{session.course}**.\n"
                "Sekarang, silakan pilih gaya belajar yang Anda inginkan:\n\n"
                "*   **A. Visual & Interaktif**: Menggunakan visualisasi konsep, diagram ASCII, dan diagram alur.\n"
                "*   **B. Auditorial & Socratic Dialogue**: Menggunakan diskusi tanya-jawab terarah untuk membimbing pemahaman Anda.\n"
                "*   **C. Praktikal & Fokus Koding**: Menggunakan contoh potongan kode, latihan praktis, dan pseudocode.\n\n"
                "*Balas dengan **A**, **B**, atau **C**.*"
            )
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
                        "name": f"Latihan Penguatan: {current_node['name']}",
                        "description": f"Materi penguatan terfokus dan sederhana untuk memantapkan pemahaman Anda tentang '{current_node['name']}' sebelum melangkah maju.",
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
                        f"\n\n🏆 **Luar Biasa!** Anda telah berhasil menguasai semua materi kuliah **{session.course}**! "
                        "Seluruh silabus telah diselesaikan dengan sangat baik. Anda dapat meninjau kembali materi kapan saja atau memilih mata kuliah baru dengan mengetik **/reset**."
                    )

    # 7. Simpan Riwayat Chat
    chat_history.append({"role": "user", "content": user_message})
    chat_history.append({"role": "bot", "content": ai_reply})
    
    return _build_response(ai_reply, file_url, file_name, file_size, file_type)

def _build_response(reply: str, file_url, file_name, file_size, file_type):
    response = {"reply": reply}
    if file_url:
        response["file_url"] = file_url
        response["file_name"] = file_name
        response["file_size"] = file_size
        response["file_type"] = file_type
    return response
