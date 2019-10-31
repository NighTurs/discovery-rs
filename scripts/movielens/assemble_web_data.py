import argparse
import pickle
import pandas as pd
from os import path


def assemble_web_data(raw_dir, processed_dir):
    with open(path.join(processed_dir, 'x2i.pickle'), 'rb') as handle:
        x2i = pickle.load(handle)
    tsne_emb = pd.read_csv(path.join(processed_dir, 'tsne_emb.csv'))
    with open(path.join(processed_dir, 'bias.pickle'), 'rb') as handle:
        bias = pickle.load(handle)
    with open(path.join(processed_dir, 'recommendations.pickle'), 'rb') as handle:
        recommendations = pickle.load(handle)
    movies = pd.read_csv(path.join(raw_dir, 'movies.csv'))
    links = pd.read_csv(path.join(raw_dir, 'links.csv'))
    tags = pd.read_csv(path.join(raw_dir, 'genome-tags.csv'))
    tag_score = pd.read_csv(path.join(raw_dir, 'genome-scores.csv'))
    tags = tag_score.merge(tags, on='tagId')
    tags = tags.groupby('movieId').apply(lambda x: ', '.join(
        [y.tag for y in x.sort_values('relevance', ascending=False).iloc[:10, :].itertuples()]))

    movies = movies.merge(links, on='movieId', how='outer')
    movies = {x.movieId: (x.title, x.genres, x.imdbId)
              for x in movies.itertuples()}
    ds = pd.read_csv(path.join(processed_dir, 'ds.csv'))
    freq = ds.groupby('item')['user'].count()
    freq_pct = percentile(freq)
    avg_rating_pct = percentile(pd.Series(bias))

    i2x = {v: k for k, v in x2i.items()}
    nmovies = len(x2i)
    web = pd.DataFrame({'idx': [*range(nmovies)],
                        'x': tsne_emb['x'][:-1],
                        'y': tsne_emb['y'][:-1],
                        't_name': [movies[i2x[i]][0] for i in range(nmovies)],
                        't_genres': [', '.join(movies[i2x[i]][1].split('|')) for i in range(nmovies)],
                        't_tags': [tags.at[i2x[i]] if i2x[i] in tags.index else '' for i in range(nmovies)],
                        'recommend_rating': recommendations,
                        'n_recommend_pct': percentile(pd.Series(recommendations)),
                        'avg_rating': bias,
                        'n_avg_rating_pct': avg_rating_pct,
                        'freq': freq,
                        'n_freq_pct': freq_pct,
                        'ml_id': [i2x[i] for i in range(nmovies)],
                        'imdb_id': [movies[i2x[i]][2] for i in range(nmovies)]})
    web.to_csv(path.join(processed_dir, 'web.csv'),
               index=False, float_format='%.5f')


def percentile(series):
    d = {k: v / len(series)
         for v, k in enumerate(series.sort_values().index.values)}
    return [d[i] for i in series.index.values]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw_dir', required=True,
                        help='Directory with raw Movielens dataset')
    parser.add_argument('--processed_dir', required=True,
                        help='Directory with processed Movielens dataset')
    args = parser.parse_args()
    assemble_web_data(args.raw_dir, args.processed_dir)
