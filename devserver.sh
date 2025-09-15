#!/bin/sh
source .venv/bin/activate
python -u -m flask --app main run --port=8080 --debug