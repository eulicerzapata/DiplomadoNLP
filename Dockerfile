# Dockerfile for FastAPI EcoSort AI
# -------------------------------------------------
# Base image: official Python 3.10 (lightweight)
FROM python:3.10-slim

# Set environment variables for non‑interactive installs
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Create and set working directory
WORKDIR /app

# Copy only the requirements first (leverages Docker cache)
COPY requirements.txt ./

# Install system dependencies (if any) – for TensorFlow we need libglib2.0-0, libsm6, libxext6, libxrender1
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 libsm6 libxext6 libxrender1 && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install -r requirements.txt

# Copy the rest of the application code
COPY . ./

# Expose the port expected by Hugging Face Spaces (7860)
EXPOSE 7860

# Set the default command to launch the FastAPI app with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
