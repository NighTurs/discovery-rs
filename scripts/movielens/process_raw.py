import argparse
import pickle
import pandas as pd
import os
from os import path


def process_raw(input_dir, output_dir, movie_users_threshold, user_movies_threshold):
    ds = pd.read_csv(path.join(input_dir, 'ratings.csv'))
    print('Overall records:', ds.shape[0])
    print('Overall users:', len(ds['userId'].unique()))
    print('Overall movies:', len(ds['movieId'].unique()))

    ds = keep_positive_ratings(ds)
    ds = movie_user_count_filter(ds, movie_users_threshold)
    ds = user_movie_count_filter(ds, user_movies_threshold)

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


def keep_positive_ratings(ds, pct_cutoff=0.1):
    ulen = {row.userId: row.movieId for row in ds.groupby(
        'userId')['movieId'].count().reset_index().itertuples()}
    res = ds[ds['rating'] == 5.0]
    ulenct = {row.userId: row.movieId for row in res.groupby(
        'userId')['movieId'].count().reset_index().itertuples()}
    for rating in reversed(range(8, 10)):
        r = rating / 2
        chunks = []
        for user, group in ds[ds['rating'] == r].groupby('userId'):
            if ulenct.get(user, 0) < ulen[user] * pct_cutoff:
                chunks.append(group)
                ulenct[user] = ulenct.get(user, 0) + group.shape[0]
        res = pd.concat(chunks + [res])
        del chunks
    return res


def movie_user_count_filter(ds, artist_users_threshold):
    ct = ds.groupby('movieId')['userId'].count()
    keep_movies = ct[ct >= artist_users_threshold].index.values
    return ds[ds['movieId'].isin(keep_movies)]


def user_movie_count_filter(ds, user_artist_threshold):
    ct = ds.groupby('userId')['movieId'].count()
    keep_users = ct[ct >= user_artist_threshold].index.values
    return ds[ds['userId'].isin(keep_users)]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Path to movielens dataset directory')
    parser.add_argument('--output_dir', required=True,
                        help='Directory to put processed files into')
    parser.add_argument('--movie_users_threshold', type=int, required=False, default=5,
                        help='Users per movie threshold to filter')
    parser.add_argument('--user_movies_threshold', type=int, required=False, default=5,
                        help='Movies per user threshold to filter')
    args = parser.parse_args()
    process_raw(args.input_dir, args.output_dir,
                args.movie_users_threshold, args.user_movies_threshold)
