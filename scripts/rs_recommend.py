import argparse
import pickle
import numpy as np
import pandas as pd
from scipy.sparse import coo_matrix
from recoder.model import Recoder
from recoder.nn import DynamicAutoencoder
from recoder.data import UsersInteractions
from os import path
from scripts.config import params


def rs_recommend(proc_dir, model_path, item_list):
    with open(path.join(proc_dir, 'x2i.pickle'), 'rb') as handle:
        x2i = pickle.load(handle)

    model = DynamicAutoencoder()
    recoder = Recoder(model)
    recoder.init_from_model_file(model_path)

    interactions = load_item_list(x2i, recoder.num_items, item_list)

    out = recoder.predict(interactions)
    with open(path.join(proc_dir, 'recommendations.pickle'), 'wb') as handle:
        pickle.dump(out[0].detach().squeeze(0).numpy(), handle)


def load_item_list(x2i, nitems, item_list):
    items = pd.read_csv(item_list)
    ids = []
    for raw in items['raw_id']:
        if raw in x2i:
            ids.append(x2i[raw])
        else:
            print('Id {} not found'.format(raw))
    csr_matrix = coo_matrix((np.ones(len(ids)), (np.zeros(
        len(ids)), np.array(ids))), shape=(1, nitems)).tocsr()

    return UsersInteractions(np.array([0]), csr_matrix)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--domain', required=True,
                        help='Short name of data domain, e.g. lf for last.fm')
    args = parser.parse_args()
    p = params[args.domain]
    proc_dir = p['common']['proc_dir']
    rs_recommend(proc_dir=proc_dir,
                 model_path=path.join(params['models_dir'], args.domain + '.model'),
                 item_list=path.join(proc_dir, 'rec_items.csv'))
