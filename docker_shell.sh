#!/usr/bin/env bash

docker run --rm -it \
  --gpus all \
  --ipc=host \
  --user="$(id -u):$(id -g)" \
  --mount type=bind,src=$(pwd),dst=/app \
  discovery-rs bash
