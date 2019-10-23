import argparse
import pickle
import pandas as pd
import os
from os import path


def process_raw(input_dir, output_dir):
    ds = pd.read_csv(path.join(input_dir, 'ratings.csv'))

    u2i = {user: ind for ind, user in enumerate(ds['userId'].unique())}
    m2i = {movie: ind for ind, movie in enumerate(ds['movieId'].unique())}

    processed = pd.DataFrame({'user': ds['userId'].apply(lambda x: u2i[x]),
                              'movie': ds['movieId'].apply(lambda x: m2i[x]),
                              'rating': ds['rating'],
                              'timestamp': ds['timestamp']})

    if not path.exists(output_dir):
        os.makedirs(output_dir)
    processed.to_csv(path.join(output_dir, 'ds.csv'), index=False)
    with open(path.join(output_dir, 'u2i.pickle'), 'wb') as handle:
        pickle.dump(u2i, handle)

    with open(path.join(output_dir, 'm2i.pickle'), 'wb') as handle:
        pickle.dump(m2i, handle)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Path to movielens dataset directory')
    parser.add_argument('--output_dir', required=True,
                        help='Directory to put processed files into')
    args = parser.parse_args()
    process_raw(args.input_dir, args.output_dir)
