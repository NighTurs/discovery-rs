import torch
import argparse
import pandas as pd
import numpy as np
from os import path
from openTSNE import TSNE, TSNEEmbedding, affinity, initialization
from openTSNE import initialization
from openTSNE.callbacks import ErrorLogger


def tsne_emb(model_path, output_dir):
    model = torch.load(model_path, map_location=torch.device('cpu'))['model']
    w = model['memb.weight'].numpy()

    affinities_multiscale_mixture = affinity.Multiscale(
        w,
        perplexities=[50, 500],
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
        n_iter=1500, exaggeration=None, momentum=0.8, learning_rate=1000)
    df = pd.DataFrame(embedding, columns=['x', 'y'])
    df.to_csv(path.join(output_dir, 'tsne_emb.csv'), index=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True,
                        help='Saved RS model')
    parser.add_argument('--output_dir', required=True, help='Output directory')
    args = parser.parse_args()
    tsne_emb(args.model, args.output_dir)
