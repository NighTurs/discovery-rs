FROM pytorch/pytorch:1.5.1-cuda10.1-cudnn7-runtime

RUN apt-get update
RUN apt-get install -y build-essential git curl zip unzip wget
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs

COPY requirements_freeze.txt requirements.txt
RUN pip install -r requirements.txt

COPY package*.json ./
RUN npm install --global

RUN mkdir /app
WORKDIR /app

CMD /bin/bash