import argparse
import pickle
import numpy as np
import pandas as pd
from os import path
import torch
import torch.nn as nn
from .train_rs import ExplicitRecModel


def rs_recommend(input_dir, model_path, item_list):
    with open(path.join(input_dir, 'x2i.pickle'), 'rb') as handle:
        x2i = pickle.load(handle)
    items, ratings = load_item_ratings(x2i, item_list)
    with open(path.join(input_dir, 'bias.pickle'), 'rb') as handle:
        bias = pickle.load(handle)
    for i, item in enumerate(items[0]):
        ratings[0][i] -= bias[item]
    model_state_dict = torch.load(
        model_path, map_location=torch.device('cpu'))['model']
    emb_size = model_state_dict['emb.weight'].shape[1]
    model = ExplicitRecModel(len(x2i) + 1, emb_size)
    model.load_state_dict(model_state_dict)

    x_w = torch.ones_like(ratings)
    y_m = torch.tensor([*range(len(x2i))], dtype=torch.int64).unsqueeze(0)
    recs = (model(items, ratings, x_w, y_m, items).detach().squeeze(0) + bias).numpy()
    with open(path.join(input_dir, 'recommendations.pickle'), 'wb') as handle:
        pickle.dump(recs, handle)


def load_item_ratings(x2i, item_list):
    d = pd.read_csv(item_list)
    items = torch.tensor([x2i[id] for id in  d['itemId']], dtype=torch.int64)
    ratings = torch.tensor(d['rating'], dtype=torch.float32)
    return items.unsqueeze(0), ratings.unsqueeze(0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Directory with processed Lastfm 350K dataset')
    parser.add_argument('--model_path', required=True,
                        help='Model file path')
    parser.add_argument('--item_list', required=True,
                        help='File with items to use for recommendations')
    args = parser.parse_args()

    rs_recommend(args.input_dir, args.model_path,
                 args.item_list)