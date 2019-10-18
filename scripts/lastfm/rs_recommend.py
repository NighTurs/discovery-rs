import argparse
import pickle
import numpy as np
from os import path
import torch
import torch.nn as nn
from .train_rs import RecModel


def rs_recommend(input_dir, model_path, artist_list, with_bias):
    with open(path.join(input_dir, 'a2i.pickle'), 'rb') as handle:
        a2i = pickle.load(handle)
    artist_vec = load_artist_list(a2i, artist_list)

    model_state_dict = torch.load(
        model_path, map_location=torch.device('cpu'))['model']
    emb_size = model_state_dict['fc2.weight'].shape[1]
    model = RecModel(len(a2i), emb_size, np.zeros(len(a2i)))
    model.load_state_dict(model_state_dict)
    if not with_bias:
        model.abias.data = nn.Parameter(torch.zeros_like(model.abias))
        model.fc2.bias = nn.Parameter(torch.zeros_like(model.fc2.bias))

    recs = model(artist_vec).detach().squeeze(0).numpy()
    with open(path.join(input_dir, 'recommendations.pickle'), 'wb') as handle:
        pickle.dump(recs, handle)


def load_artist_list(a2i, artist_list):
    with open(artist_list, 'r') as f:
        artists = [a[:-1] for a in f.readlines()]

    an2i = {name.lower(): a2i[(name, mbid)] for name, mbid in a2i.keys()}
    ids = []
    for artist in artists:
        if artist not in an2i:
            print('Not found artist: {}'.format(artist))
            continue
        ids.append(an2i[artist])

    x = np.zeros(len(a2i), dtype=np.float32)
    x[ids] = 1
    x = torch.tensor(x).unsqueeze(0)
    return x


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Directory with processed Lastfm 350K dataset')
    parser.add_argument('--model_path', required=True,
                        help='Model file path')
    parser.add_argument('--artist_list', required=True,
                        help='File with artists to use for recommendations')
    parser.add_argument('--with_bias', dest='with_bias', action='store_true',
                        help="Use bias")
    parser.set_defaults(with_bias=False)
    args = parser.parse_args()

    rs_recommend(args.input_dir, args.model_path,
                 args.artist_list, args.with_bias)
