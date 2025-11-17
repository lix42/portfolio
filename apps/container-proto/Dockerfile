FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Create a non-root user and group
RUN addgroup --system app && adduser --system --group app

WORKDIR /app

COPY container/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY container/app ./app
COPY schema ./schema

# Change ownership to the non-root user
RUN chown -R app:app /app

# Switch to the non-root user
USER app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
