import pickle
import pandas as pd
import os
from os import path
from scripts.process_raw import keep_positive_ratings, count_filter
from scripts.config import params


def process_raw(input_dir: str, output_dir: str, book_users_threshold: int, user_books_threshold: int):
    ds = pd.read_csv(path.join(input_dir, 'ratings.csv'))
    print('Overall records:', ds.shape[0])
    print('Overall users:', len(ds['user_id'].unique()))
    print('Overall books:', len(ds['book_id'].unique()))

    ds = keep_positive_ratings(ds, 'user_id', 'book_id', 'rating')
    ds = count_filter(ds, book_users_threshold, 'book_id', 'user_id')
    ds = count_filter(ds, user_books_threshold, 'user_id', 'book_id')

    print('Left records:', ds.shape[0])
    print('Left users:', len(ds['user_id'].unique()))
    print('Left books:', len(ds['book_id'].unique()))

    u2i = {user: ind for ind, user in enumerate(ds['user_id'].unique())}
    x2i = {book: ind for ind, book in enumerate(ds['book_id'].unique())}

    processed = pd.DataFrame({'user': ds['user_id'].apply(lambda x: u2i[x]),
                              'item': ds['book_id'].apply(lambda x: x2i[x])})

    if not path.exists(output_dir):
        os.makedirs(output_dir)
    processed.to_csv(path.join(output_dir, 'ds.csv'), index=False)
    with open(path.join(output_dir, 'u2i.pickle'), 'wb') as handle:
        pickle.dump(u2i, handle)

    with open(path.join(output_dir, 'x2i.pickle'), 'wb') as handle:
        pickle.dump(x2i, handle)


if __name__ == '__main__':
    common_params = params['gb']['common']
    proc_params = params['gb']['process_raw']

    process_raw(common_params['raw_dir'],
                common_params['proc_dir'],
                int(proc_params['book_users_threshold']),
                int(proc_params['user_books_threshold']))
