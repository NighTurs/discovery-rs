import torch
import argparse
import pandas as pd
import numpy as np
from os import path
from openTSNE import TSNE, TSNEEmbedding, affinity, initialization
from openTSNE import initialization
from openTSNE.callbacks import ErrorLogger


def tsne_emb(model_path, output_dir, layer_name, perplexities, lr, n_iter):
    model = torch.load(model_path, map_location=torch.device('cpu'))['model']
    w = model[layer_name].numpy()

    affinities_multiscale_mixture = affinity.Multiscale(
        w,
        perplexities=perplexities,
        metric="cosine",
        n_jobs=-1,
        random_state=3)

    init = initialization.pca(w, random_state=42)

    embedding = TSNEEmbedding(
        init,
        affinities_multiscale_mixture,
        negative_gradient_method="fft",
        n_jobs=-1,
        callbacks=ErrorLogger())

    embedding = embedding.optimize(
        n_iter=n_iter, exaggeration=None, momentum=0.8, learning_rate=lr)
    df = pd.DataFrame(embedding, columns=['x', 'y'])
    df.to_csv(path.join(output_dir, 'tsne_emb.csv'), index=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True,
                        help='Saved RS model')
    parser.add_argument('--layer_name', required=True,
                        help='Embedding layer name')
    parser.add_argument('--perplexities', required=True,
                        type=int, nargs='+', help='Perplexities')
    parser.add_argument('--lr', required=True, type=int, help='Learning rate')
    parser.add_argument('--n_iter', required=True,
                        type=int, help='Number of iterations')
    parser.add_argument('--output_dir', required=True, help='Output directory')
    args = parser.parse_args()
    tsne_emb(args.model, args.output_dir, args.layer_name, args.perplexities, args.lr, args.n_iter)
