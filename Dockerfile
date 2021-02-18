FROM pytorch/pytorch:1.7.1-cuda11.0-cudnn8-runtime

RUN apt-get update
RUN apt-get install -y build-essential git curl zip unzip wget
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs

COPY requirements_freeze.txt requirements.txt
RUN pip install --ignore-installed -r requirements.txt

COPY package*.json ./
RUN npm install --global

RUN mkdir /app
WORKDIR /app

CMD /bin/bash