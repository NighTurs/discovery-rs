import argparse
import numpy as np
import pandas as pd
from scipy.sparse import coo_matrix
from recoder.model import Recoder
from recoder.nn import DynamicAutoencoder
from recoder.data import UsersInteractions
from flask import request, Flask, jsonify, abort
from flask_cors import CORS
from .utils import percentile

app = Flask(__name__)
CORS(app)

models = dict()


@app.route('/', methods=['POST'])
def create_task():
    if not request.json or not 'ds' in request.json or not 'idxs' in request.json:
        abort(400)

    model = models[request.json['ds']]
    idxs = [int(x) for x in request.json['idxs']]
    csr_matrix = coo_matrix((np.ones(len(idxs)), (np.zeros(
        len(idxs)), np.array(idxs))), shape=(1, model.num_items)).tocsr()
    ui = UsersInteractions(np.array([0]), csr_matrix)
    recs = percentile(pd.Series(model.predict(
        ui)[0].detach().squeeze(0).numpy()))
    return jsonify({'recs': recs}), 201


def load_models(ds, model_paths):
    print('here')
    for d, model_file in zip(ds, model_paths):
        model = DynamicAutoencoder()
        recoder = Recoder(model)
        recoder.init_from_model_file(model_file)
        models[d] = recoder


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, required=True,
                        help='Port')
    parser.add_argument('--ds', nargs='+', required=True,
                        help='Dataset names')
    parser.add_argument('--models', nargs='+', required=True,
                        help='Paths to dataset models')

    args = parser.parse_args()
    load_models(args.ds, args.models)
    app.run(debug=False, port=args.port)
