import argparse
import pickle
import pandas as pd
from os import path
from scripts.assemble_web_data import percentile, rescale_tsne
from scripts.config import params


def assemble_web_data(processed_dir):
    with open(path.join(processed_dir, 'x2i.pickle'), 'rb') as handle:
        x2i = pickle.load(handle)
    tsne_emb = pd.read_csv(path.join(processed_dir, 'tsne_emb.csv'))
    tsne_emb = rescale_tsne(tsne_emb)
    with open(path.join(processed_dir, 'recommendations.pickle'), 'rb') as handle:
        recommendations = pickle.load(handle)
    info = pd.read_csv(path.join(processed_dir, 'info.csv'))

    nsongs = len(x2i)
    web = pd.DataFrame({'idx': [*range(nsongs)],
                        'x': tsne_emb['x'],
                        'y': tsne_emb['y'],
                        't_name': info['artist'].str.cat(info['title'], sep=' - '),
                        't_release': info['release'],
                        'tags': info['tags'],
                        'year': info['year'],
                        'duration': info['duration'],
                        'recommend_value': recommendations,
                        'n_recommend_pct': percentile(pd.Series(recommendations)),
                        'n_artist_familiarity': info['artist_familiarity'],
                        'n_artist_hotness': info['artist_hotness']})
    web.to_csv(path.join(processed_dir, 'web.csv'),
               index=False, float_format='%.5f')


if __name__ == '__main__':
    assemble_web_data(params['msd']['common']['proc_dir'])
