FROM python:3.10-slim

WORKDIR /app

# Menginstal dependency
COPY backend/requirements.txt .
RUN SKLEARN_ALLOW_DEPRECATED_SKLEARN_PACKAGE_INSTALL=True pip install --no-cache-dir -r requirements.txt

# Menyalin seluruh kode repository
COPY . .

# Berpindah ke folder backend untuk menjalankan server
WORKDIR /app/backend

# Membuat folder sessions dan uploads jika belum ada
RUN mkdir -p sessions uploads

# Mengekspos port 7860 (Standar wajib Hugging Face Spaces)
EXPOSE 7860

# Menjalankan server FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
