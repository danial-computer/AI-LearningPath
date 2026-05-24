from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time

app = FastAPI(
    title="AI Learning Path API",
    description="Backend API untuk chatbot dan sistem rekomendasi belajar adaptif",
    version="1.0.0"
)

# Konfigurasi CORS agar Next.js (frontend) bisa memanggil API ini
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    message: str

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend API AI Learning Path berjalan dengan baik!"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/chat")
def chat_with_ai(chat: ChatMessage):
    # Simulasi latency proses AI
    time.sleep(1)
    
    user_text = chat.message.lower()
    
    # 1. Simulasi Ethical Guardrail (Intervensi)
    if "ingin berhenti" in user_text or "menyerah" in user_text or "dropout" in user_text:
        reply = "⚠️ [Intervensi Sistem]\nSaya mengerti ini mungkin terasa berat. Berdasarkan data, banyak mahasiswa yang mengalami kesulitan di tahap ini, namun berhasil lulus setelah mengulang kuis praktikum. Apakah Anda ingin mencoba latihan yang lebih mudah dulu untuk mengembalikan kepercayaan diri?"
        return {"reply": reply}
    
    # 2. Simulasi Socratic Tutor (Tidak memberi jawaban langsung)
    if "jawaban" in user_text or "kodingan" in user_text or "buatkan" in user_text:
        reply = "🔍 Sebagai AI Tutor, saya tidak bisa memberikan jawaban langsung (aturan silabus praktikum). Tapi mari kita pecahkan masalahnya bersama. Di bagian mana spesifiknya kode Anda mengalami error?"
        return {"reply": reply}
        
    # 3. Respon General
    reply = f"Menarik! Anda bertanya tentang: '{chat.message}'. Berdasarkan log belajar Anda (Knowledge Tracing), mari kita kaitkan ini dengan konsep yang sudah Anda kuasai minggu lalu. Apa pemahaman awal Anda tentang topik ini?"
    
    return {"reply": reply}
