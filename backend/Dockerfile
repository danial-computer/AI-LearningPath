FROM python:3.10-slim

WORKDIR /app

# Salin requirements dan instal
COPY requirements.txt .
RUN SKLEARN_ALLOW_DEPRECATED_SKLEARN_PACKAGE_INSTALL=True pip install --no-cache-dir -r requirements.txt

# Salin seluruh file
COPY . .

# Buat folder sessions dan uploads
RUN mkdir -p sessions uploads

EXPOSE 7860

# Jalankan server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]