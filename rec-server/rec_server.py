import os
import re
import numpy as np
from scipy.sparse import coo_matrix
from recoder.model import Recoder
from recoder.nn import DynamicAutoencoder
from recoder.data import UsersInteractions
from flask import request, Flask, jsonify, abort
from flask_cors import CORS
from typing import Dict

MODELS_DIR = os.getenv('MODELS_DIR')

app = Flask(__name__)
CORS(app)


def load_models() -> Dict[str, Recoder]:
    model_paths = {}
    model_re = re.compile(r'^(?P<ds>.*)\.model$')
    for f in os.listdir(MODELS_DIR):
        match = model_re.match(f)
        if match:
            model_paths[match.group('ds')] = os.path.join(MODELS_DIR, f)
    recorders = {}
    for ds, path in model_paths.items():
        model = DynamicAutoencoder()
        recoder = Recoder(model)
        recoder.init_from_model_file(path)
        recorders[ds] = recoder
    return recorders


models = load_models()


def percentile(values: np.ndarray):
    order = values.argsort()
    ranks = order.argsort()
    return ranks / len(values)


@app.route('/', methods=['POST'])
def create_task():
    if not request.json or not 'ds' in request.json or not 'idxs' in request.json:
        abort(400)
    model = models[request.json['ds']]
    idxs = [int(x) for x in request.json['idxs']]
    csr_matrix = coo_matrix((np.ones(len(idxs)), (np.zeros(
        len(idxs)), np.array(idxs))), shape=(1, model.num_items)).tocsr()
    ui = UsersInteractions(np.array([0]), csr_matrix)
    recs = percentile(model.predict(ui)[0].detach().squeeze(0).numpy())
    return jsonify({'recs': recs.tolist()}), 201
