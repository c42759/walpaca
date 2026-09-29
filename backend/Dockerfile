FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

EXPOSE 5000

ENV ALPACA_DB_PATH=/app/alpaca.db

CMD ["python", "main.py"]
