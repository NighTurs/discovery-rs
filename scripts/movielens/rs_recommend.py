import argparse
import pickle
import numpy as np
import pandas as pd
from os import path
import torch
import torch.nn as nn
from .train_rs import RecModel


def rs_recommend(input_dir, model_path, artist_list):
    with open(path.join(input_dir, 'm2i.pickle'), 'rb') as handle:
        m2i = pickle.load(handle)
    movies, ratings = load_movie_ratings(m2i, artist_list)
    with open(path.join(input_dir, 'bias.pickle'), 'rb') as handle:
        bias = pickle.load(handle)
    for i, movie in enumerate(movies[0]):
        ratings[0][i] -= bias[movie]
    model_state_dict = torch.load(
        model_path, map_location=torch.device('cpu'))['model']
    emb_size = model_state_dict['memb.weight'].shape[1]
    model = RecModel(len(m2i) + 1, emb_size)
    model.load_state_dict(model_state_dict)

    x_w = torch.ones_like(ratings)
    y_m = torch.tensor([*range(len(m2i))], dtype=torch.int64).unsqueeze(0)
    recs = (model(movies, ratings, x_w, y_m, movies).detach().squeeze(0) + bias).numpy()
    with open(path.join(input_dir, 'recommendations.pickle'), 'wb') as handle:
        pickle.dump(recs, handle)


def load_movie_ratings(m2i, artist_list):
    d = pd.read_csv(artist_list)
    movies = torch.tensor([m2i[id] for id in  d['movieId']], dtype=torch.int64)
    ratings = torch.tensor(d['rating'], dtype=torch.float32)
    return movies.unsqueeze(0), ratings.unsqueeze(0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Directory with processed Lastfm 350K dataset')
    parser.add_argument('--model_path', required=True,
                        help='Model file path')
    parser.add_argument('--artist_list', required=True,
                        help='File with artists to use for recommendations')
    args = parser.parse_args()

    rs_recommend(args.input_dir, args.model_path,
                 args.artist_list)