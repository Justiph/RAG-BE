# python-extractor/Dockerfile
FROM python:3.11-slim
WORKDIR /app

# Thêm các gói hệ thống cần cho unstructured hi_res + opencv
RUN apt-get update && apt-get install -y \
    libmagic1 \
    build-essential \
    poppler-utils \
    tesseract-ocr \
    libtesseract-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 7001
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7001"]
