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
    books = pd.read_csv(path.join(raw_dir, 'books.csv'))

    tags = pd.read_csv(path.join(raw_dir, 'tags.csv'))
    book_tags = pd.read_csv(path.join(raw_dir, 'book_tags.csv'))
    tags = book_tags.merge(tags, on='tag_id')
    exclude_tags = set(['to-read', 'currently-reading', 'owned', 'books-i-own'])
    tags = tags.groupby('goodreads_book_id').apply(lambda x: ', '.join(
        [y.tag_name for y in x.sort_values('count', ascending=False).iloc[:15, :].itertuples() if y.tag_name not in exclude_tags]))

    books = {x.book_id: (x.authors, x.title, x.language_code, x.average_rating, x.goodreads_book_id)
             for x in books.itertuples()}
    ds = pd.read_csv(path.join(processed_dir, 'ds.csv'))
    freq = ds.groupby('item')['user'].count()
    freq_pct = percentile(freq)

    i2x = {v: k for k, v in x2i.items()}
    nbooks = len(x2i)
    web = pd.DataFrame({'idx': [*range(nbooks)],
                        'x': tsne_emb['x'][:-1],
                        'y': tsne_emb['y'][:-1],
                        't_name': [books[i2x[i]][1] for i in range(nbooks)],
                        't_author': [books[i2x[i]][0] for i in range(nbooks)],
                        't_language': [books[i2x[i]][2] for i in range(nbooks)],
                        't_tags': [tags.at[books[i2x[i]][4]] if books[i2x[i]][4] in tags.index else '' for i in range(nbooks)],
                        'recommend_rating': recommendations,
                        'n_recommend_pct': percentile(pd.Series(recommendations)),
                        'avg_rating': [books[i2x[i]][3] for i in range(nbooks)],
                        'n_avg_rating_pct': percentile(pd.Series([books[i2x[i]][3] for i in range(nbooks)])),
                        'freq': freq,
                        'n_freq_pct': freq_pct,
                        'goodreads_id': [books[i2x[i]][4] for i in range(nbooks)]})
    web.to_csv(path.join(processed_dir, 'web.csv'),
               index=False, float_format='%.5f')


def percentile(series):
    d = {k: v / len(series)
         for v, k in enumerate(series.sort_values().index.values)}
    return [d[i] for i in series.index.values]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw_dir', required=True,
                        help='Directory with raw Goodbooks dataset')
    parser.add_argument('--processed_dir', required=True,
                        help='Directory with processed Goodbooks dataset')
    args = parser.parse_args()
    assemble_web_data(args.raw_dir, args.processed_dir)
