FROM python:3.7
WORKDIR /code
ENV FLASK_APP rec_server.py
ENV FLASK_RUN_HOST 0.0.0.0
ENV MODELS_DIR /models
COPY requirements_freeze.txt requirements.txt
RUN pip install -r requirements.txt
CMD ["flask", "run"]
