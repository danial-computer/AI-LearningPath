---
title: AI Learning Path Backend
emoji: 🎓
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# 🎓 AI Adaptive Learning Path - Backend Server

Backend server ini berbasis **FastAPI** dan dirancang khusus untuk mendukung sistem pembelajaran adaptif pintar (_Personalized Learning Journey_). Sistem ini mengintegrasikan pemodelan graf prasyarat, pelacakan kemampuan kognitif BKT, penjadwalan spaced repetition SM-2, dan remedial loop otomatis.

## 🛠️ Fitur Utama Backend:

1. **Dynamic Path Generation (NetworkX DAG):** Mengatur alur belajar siswa berdasarkan urutan prasyarat materi.
2. **Cognitive State Tracking (BKT):** Menggunakan rumus probabilitas Bayesian Knowledge Tracing untuk menghitung pemahaman siswa setelah menjawab kuis.
3. **Spaced Repetition (SM-2):** Menjadwalkan pengulangan kartu flash untuk meningkatkan retensi ingatan jangka panjang.
4. **Dynamic Graph Restructuring (Remedial Loops):** Menyisipkan materi remedial secara instan ke dalam graf belajar siswa jika gagal kuis 2 kali berturut-turut pada topik yang sama.
5. **Gemini API Key Load Balancing:** Mengacak dan memutar 10 Kunci API Gemini untuk mendistribusikan beban limit (Rate Limit 429).
6. **Multi-model Cascade Fallback:** Menggunakan `gemini-2.5-flash` dengan fallback otomatis ke `gemini-1.5-flash` dan `gemini-1.5-pro` jika terjadi kendala server Google.

---

## 🔑 Konfigurasi Environment Secrets (Hugging Face)

Pastikan Anda telah menambahkan variabel-variabel kunci API di bawah ini di menu **Settings -> Variables and Secrets** pada Space Hugging Face Anda:

- `GEMINI_API_KEY` (Kunci API Gemini Utama Anda)
- `GEMINI_API_KEY_1` s.d. `GEMINI_API_KEY_10` (Kunci API Gemini Cadangan tambahan untuk load balancing)

---

## 🐳 Menjalankan Secara Lokal (Docker)

Jika ingin mengujinya menggunakan Docker di laptop Anda secara lokal:

```bash
# Build image docker
docker build -t ai-learningpath-backend .

# Jalankan kontainer
docker run -p 7860:7860 --env-file .env ai-learningpath-backend
```
