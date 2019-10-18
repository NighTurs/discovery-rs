import torch
import argparse
import pandas as pd
from os import path
from openTSNE import TSNE, TSNEEmbedding, affinity, initialization
from openTSNE import initialization
from openTSNE.callbacks import ErrorLogger


def tsne_emb(model_path, output_dir):
    model = torch.load(model_path, map_location=torch.device('cpu'))['model']
    w = model['fc2.weight'].numpy()

    affinities_multiscale_mixture = affinity.Multiscale(
        w,
        perplexities=[30, 200],
        metric="cosine",
        n_jobs=4,
        random_state=3)

    init = initialization.pca(w, random_state=42)

    embedding = TSNEEmbedding(
        init,
        affinities_multiscale_mixture,
        negative_gradient_method="fft",
        n_jobs=4,
        callbacks=ErrorLogger())

    embedding = embedding.optimize(n_iter=250, exaggeration=12, momentum=0.5)
    embedding = embedding.optimize(
        n_iter=2000, exaggeration=1, momentum=0.8, learning_rate=500)
    embedding = embedding.optimize(
        n_iter=2000, exaggeration=1, momentum=0.8, learning_rate=1000)
    df = pd.DataFrame(embedding, columns=['x', 'y'])
    df.to_csv(path.join(output_dir, 'tsne_emb.csv'), index=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True,
                        help='Saved RS model')
    parser.add_argument('--output_dir', required=True, help='Output directory')
    args = parser.parse_args()
    tsne_emb(args.model, args.output_dir)
