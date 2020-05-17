import pickle
import pandas as pd
import os
from os import path
from scripts.process_raw import keep_positive_ratings, count_filter
from scripts.config import params


def process_raw(input_dir, output_dir, movie_users_threshold, user_movies_threshold):
    ds = pd.read_csv(path.join(input_dir, 'ratings.csv'))
    print('Overall records:', ds.shape[0])
    print('Overall users:', len(ds['userId'].unique()))
    print('Overall movies:', len(ds['movieId'].unique()))

    ds = keep_positive_ratings(ds, 'userId', 'movieId', 'rating')
    ds = count_filter(ds, movie_users_threshold, 'movieId', 'userId')
    ds = count_filter(ds, user_movies_threshold, 'userId', 'movieId')

    print('Left records:', ds.shape[0])
    print('Left users:', len(ds['userId'].unique()))
    print('Left movies:', len(ds['movieId'].unique()))

    u2i = {user: ind for ind, user in enumerate(ds['userId'].unique())}
    x2i = {movie: ind for ind, movie in enumerate(ds['movieId'].unique())}

    processed = pd.DataFrame({'user': ds['userId'].apply(lambda x: u2i[x]),
                              'item': ds['movieId'].apply(lambda x: x2i[x])})

    if not path.exists(output_dir):
        os.makedirs(output_dir)
    processed.to_csv(path.join(output_dir, 'ds.csv'), index=False)
    with open(path.join(output_dir, 'u2i.pickle'), 'wb') as handle:
        pickle.dump(u2i, handle)

    with open(path.join(output_dir, 'x2i.pickle'), 'wb') as handle:
        pickle.dump(x2i, handle)


if __name__ == '__main__':
    common_params = params['ml']['common']
    proc_params = params['ml']['process_raw']
    process_raw(common_params['raw_dir'],
                common_params['proc_dir'],
                int(proc_params['movie_users_threshold']),
                int(proc_params['user_movies_threshold']))
