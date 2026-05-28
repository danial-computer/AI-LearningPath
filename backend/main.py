from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import time
import os
import shutil
import uuid

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


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend API AI Learning Path berjalan dengan baik!"}


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.post("/api/chat")
async def chat_with_ai(
    message: str = Form(...),
    file: UploadFile = File(None),
):
    # Simulasi latency proses AI
    time.sleep(1)

    # ─── Handle file upload ───
    file_url = None
    file_name = None
    file_size = None
    file_type = None

    if file and file.filename:
        # Buat nama unik agar tidak bentrok
        ext = os.path.splitext(file.filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)

        # Simpan file ke disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_url = f"http://localhost:8000/uploads/{unique_name}"
        file_name = file.filename
        file_size = os.path.getsize(file_path)
        file_type = file.content_type or "application/octet-stream"

    user_text = message.lower()

    # ─── 1. Simulasi Ethical Guardrail (Intervensi) ───
    if "ingin berhenti" in user_text or "menyerah" in user_text or "dropout" in user_text:
        reply = (
            "⚠️ [Intervensi Sistem]\n"
            "Saya mengerti ini mungkin terasa berat. Berdasarkan data, banyak mahasiswa yang "
            "mengalami kesulitan di tahap ini, namun berhasil lulus setelah mengulang kuis "
            "praktikum. Apakah Anda ingin mencoba latihan yang lebih mudah dulu untuk "
            "mengembalikan kepercayaan diri?"
        )
        return _build_response(reply, file_url, file_name, file_size, file_type)

    # ─── 2. Simulasi Socratic Tutor ───
    if "jawaban" in user_text or "kodingan" in user_text or "buatkan" in user_text:
        reply = (
            "🔍 Sebagai AI Tutor, saya tidak bisa memberikan jawaban langsung "
            "(aturan silabus praktikum). Tapi mari kita pecahkan masalahnya bersama. "
            "Di bagian mana spesifiknya kode Anda mengalami error?"
        )
        return _build_response(reply, file_url, file_name, file_size, file_type)

    # ─── 3. Respons jika ada file ───
    if file_url:
        reply = (
            f"📎 Saya menerima file '{file_name}' dari Anda. "
            "Bisa ceritakan apa yang ingin Anda diskusikan terkait file ini? "
            "Apa konteks atau pertanyaan spesifik yang ingin kita bahas bersama?"
        )
        return _build_response(reply, file_url, file_name, file_size, file_type)

    # ─── 4. Respons General ───
    reply = (
        f"Menarik! Anda bertanya tentang: '{message}'. "
        "Berdasarkan log belajar Anda (Knowledge Tracing), mari kita kaitkan ini dengan "
        "konsep yang sudah Anda kuasai minggu lalu. Apa pemahaman awal Anda tentang topik ini?"
    )
    return _build_response(reply, file_url, file_name, file_size, file_type)


def _build_response(reply: str, file_url, file_name, file_size, file_type):
    response = {"reply": reply}
    if file_url:
        response["file_url"] = file_url
        response["file_name"] = file_name
        response["file_size"] = file_size
        response["file_type"] = file_type
    return response
