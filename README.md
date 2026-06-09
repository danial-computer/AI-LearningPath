---
title: AI Learning Path
emoji: 🎓
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---
# 🎓 AI Learning Path & Smart AI Chatbot

Sistem ini adalah platform **Pembelajaran Adaptif Berbasis AI** yang menggabungkan analisis data pendidikan (OULAD), algoritma *Spaced Repetition* (FSRS), *Knowledge Tracing*, dan *Smart AI Chatbot* yang dilengkapi dengan *Ethical Guardrails*.

Proyek ini dibangun dengan arsitektur pemisahan modern:
- **Notebooks**: Eksperimen Machine Learning, Analisis Data (EDA), & Pemodelan Kurikulum (Knowledge Graph).
- **Backend**: API Python menggunakan FastAPI.
- **Frontend**: Antarmuka web responsif menggunakan Next.js & Tailwind CSS.

---

## 🛠️ Prasyarat (Prerequisites)

Sebelum melakukan instalasi, pastikan komputer Anda telah terinstal:
- [Git](https://git-scm.com/)
- [Python 3.9+](https://www.python.org/downloads/)
- [Node.js (versi 18 LTS ke atas)](https://nodejs.org/) & npm

---

## 🚀 Panduan Instalasi (Langkah-demi-Langkah)

### 1. Clone Repositori
Buka Terminal / Command Prompt, lalu jalankan:
```bash
git clone https://github.com/danial-computer/ai-learning-path.git
cd ai-learning-path
```

> **Catatan Dataset:** Dataset mentah (OULAD) tidak disertakan dalam repositori ini karena ukurannya yang besar (>100MB). Jika Anda ingin menjalankan ulang file Jupyter Notebook di folder `notebook/`, pastikan Anda mengunduh dataset OULAD secara terpisah dan memasukkannya ke dalam folder `dataset/`.

---

### 2. Setup Backend (FastAPI Python)

Backend bertugas menjalankan logika AI dan menghubungkan aplikasi dengan database/silabus.

1. Buka terminal baru dan masuk ke folder backend:
   ```bash
   cd backend
   ```
2. Buat *Virtual Environment* (Direkomendasikan agar paket tidak bentrok):
   ```bash
   python -m venv venv
   ```
3. Aktifkan *Virtual Environment*:
   - **Windows:** `venv\Scripts\activate`
   - **Mac/Linux:** `source venv/bin/activate`
4. Instal semua dependensi:
   ```bash
   pip install -r requirements.txt
   ```
5. Jalankan server Backend:
   ```bash
   uvicorn main:app --reload
   ```
   *Server Backend sekarang berjalan di **http://localhost:8000***

---

### 3. Setup Frontend (Next.js React)

Frontend bertugas menampilkan antarmuka grafis (UI) yang interaktif kepada mahasiswa.

1. Buka terminal baru dan masuk ke folder frontend:
   ```bash
   cd frontend
   ```
2. Instal semua paket Node.js:
   ```bash
   npm install
   ```
3. Jalankan server *Development* Frontend:
   ```bash
   npm run dev
   ```
   *Aplikasi web sekarang berjalan di **http://localhost:3000***

---

## 📁 Struktur Direktori Utama

```text
📦 project
 ┣ 📂 backend/        # Server API FastAPI (Logika AI & Chatbot)
 ┣ 📂 frontend/       # Web UI Next.js (Dashboard & Antarmuka Chat)
 ┣ 📂 notebook/       # File Jupyter Notebook (EDA, ML Models, pyBKT)
 ┣ 📂 silabus/        # File JSON DAG Silabus Mata Kuliah
 ┗ 📜 README.md       # Dokumentasi panduan setup ini
```

## 🤖 Menghubungkan LLM (Gemini API)
*Catatan: Secara default, fitur Chatbot pada repositori ini menggunakan simulasi (dummy data).*
Jika Anda ingin menghidupkan kemampuan AI Smart AI Tutor sungguhan, Anda perlu:
1. Memiliki API Key dari Google Gemini Studio.
2. Memasukkan API Key tersebut ke dalam file konfigurasi atau `.env` di folder `backend/` nantinya saat integrasi LLM penuh diaktifkan.

---
*Didesain dan dikembangkan sebagai bagian dari Proyek Reasoning & Planning dalam AI.*
