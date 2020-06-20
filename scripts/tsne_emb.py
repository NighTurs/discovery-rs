import torch
import argparse
import pandas as pd
from os import path
from openTSNE import TSNEEmbedding, affinity
from openTSNE import initialization
from typing import List

from scripts.config import params


def tsne_emb(model_path: str, proc_dir: str, layer_name: str, perplexities: List[int], n_iter: int):
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
        random_state=4,
        verbose=True)

    embedding = embedding.optimize(
        n_iter=n_iter, exaggeration=None, momentum=0.8, learning_rate="auto")
    df = pd.DataFrame(embedding, columns=['x', 'y'])
    df.to_csv(path.join(proc_dir, 'tsne_emb.csv'), index=False)

    with open(path.join(proc_dir, 'kl_divergence'), 'w') as f:
        f.write(f'{embedding.kl_divergence:.4f}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--domain', required=True,
                        help='Short name of data domain, e.g. lf for last.fm')
    args = parser.parse_args()
    p = params[args.domain]
    pt = p['tsne_emb']
    tsne_emb(model_path=path.join(params['models_dir'], args.domain + '.model'),
             proc_dir=p['common']['proc_dir'],
             layer_name=pt['layer_name'],
             perplexities=[int(x) for x in pt['perplexities']],
             n_iter=pt['n_iter'])
