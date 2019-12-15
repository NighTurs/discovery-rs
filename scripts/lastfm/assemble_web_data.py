import argparse
import pickle
import pandas as pd
from os import path
from ..utils import percentile, rescale_tsne


def assemble_web_data(input_dir):
    with open(path.join(input_dir, 'a2i.pickle'), 'rb') as handle:
        a2i = pickle.load(handle)
    tsne_emb = pd.read_csv(path.join(input_dir, 'tsne_emb.csv'))
    tsne_emb = rescale_tsne(tsne_emb)
    with open(path.join(input_dir, 'recommendations.pickle'), 'rb') as handle:
        recommendations = pickle.load(handle)
    musicbrainz = pd.read_csv(path.join(input_dir, 'musicbrainz.csv'), dtype={
                              'founded': str, 'dissolved': str}, index_col='mbid')
    musicbrainz = pd.DataFrame({'mbid': [k[1] for k in a2i.keys()]}).merge(
        musicbrainz, on='mbid', how='left')
    ds = pd.read_csv(path.join(input_dir, 'ds.csv'))
    listeners = ds.groupby('item')['user'].count()
    listeners_pct = percentile(listeners)

    i2a = {v: k for k, v in a2i.items()}
    nartists = len(a2i)
    web = pd.DataFrame({'idx': [*range(nartists)],
                        'x': tsne_emb['x'],
                        'y': tsne_emb['y'],
                        't_name': [i2a[i][0] for i in range(nartists)],
                        't_tags': musicbrainz['tags'],
                        't_country': musicbrainz['country'],
                        'founded': musicbrainz['founded'],
                        'dissolved': musicbrainz['dissolved'],
                        'recommend_value': recommendations,
                        'n_pct_recommend': percentile(pd.Series(recommendations)),
                        'listeners': listeners,
                        'n_listeners_pct': listeners_pct})
    web.to_csv(path.join(input_dir, 'web.csv'),
               index=False, float_format='%.5f')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Directory with processed Lastfm 350K dataset')
    args = parser.parse_args()
    assemble_web_data(args.input_dir)
