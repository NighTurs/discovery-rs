FROM pytorch/pytorch:1.4-cuda10.1-cudnn7-runtime

RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs zip unzip wget

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY package*.json ./
RUN npm install --global

RUN mkdir /app
WORKDIR /app

CMD /bin/bash