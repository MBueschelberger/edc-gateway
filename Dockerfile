FROM python:3.11-slim

RUN apt update && apt upgrade -y

WORKDIR /app

COPY pyproject.toml .
RUN pip install --upgrade pip wheel setuptools \
 && pip install --no-cache-dir .

COPY app/ app/
COPY entrypoint.sh .

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
CMD ["bash", "entrypoint.sh"]
