import argparse
import pickle
import pandas as pd
from os import path


def assemble_web_data(input_dir):
    with open(path.join(input_dir, 'a2i.pickle'), 'rb') as handle:
        a2i = pickle.load(handle)
    tsne_emb = pd.read_csv(path.join(input_dir, 'tsne_emb.csv'))
    with open(path.join(input_dir, 'recommendations.pickle'), 'rb') as handle:
        recommendations = pickle.load(handle)
    with open(path.join(input_dir, 'musicbrainz.pickle'), 'rb') as handle:
        musicbrainz = pickle.load(handle)
    ds = pd.read_csv(path.join(input_dir, 'ds.csv'))
    listeners = ds.groupby('artist')['user'].count()
    listeners_pct = percentile(listeners)

    i2a = {v: k for k, v in a2i.items()}
    nartists = len(a2i)
    web = pd.DataFrame({'idx': [*range(nartists)],
                        'x': tsne_emb['x'],
                        'y': tsne_emb['y'],
                        't_name': [i2a[i][0] for i in range(nartists)],
                        't_tags': [', '.join(musicbrainz[i]['tags']) for i in range(nartists)],
                        't_country': [musicbrainz[i]['country'] for i in range(nartists)],
                        'founded': [musicbrainz[i]['founded'] for i in range(nartists)],
                        'dissolved': [musicbrainz[i]['dissolved'] for i in range(nartists)],
                        'n_pct_recommend': recommendations,
                        'listeners': listeners,
                        'n_listeners_pct': listeners_pct})
    web.to_csv(path.join(input_dir, 'web.csv'),
               index=False, float_format='%.5f')


def percentile(series):
    d = {k: v / len(series)
         for v, k in enumerate(series.sort_values().index.values)}
    return [d[i] for i in series.index.values]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Directory with processed Lastfm 350K dataset')
    args = parser.parse_args()
    assemble_web_data(args.input_dir)
