import argparse
import pickle
import pandas as pd
import os
from os import path


def process_raw(input_dir, output_dir, book_users_threshold):
    ds = pd.read_csv(path.join(input_dir, 'ratings.csv'))
    print('Overall records:', ds.shape[0])
    print('Overall users:', len(ds['user_id'].unique()))
    print('Overall books:', len(ds['book_id'].unique()))

    ds = book_user_count_filter(ds, book_users_threshold)

    print('Left records:', ds.shape[0])
    print('Left users:', len(ds['user_id'].unique()))
    print('Left books:', len(ds['book_id'].unique()))

    u2i = {user: ind for ind, user in enumerate(ds['user_id'].unique())}
    x2i = {book: ind for ind, book in enumerate(ds['book_id'].unique())}

    processed = pd.DataFrame({'user': ds['user_id'].apply(lambda x: u2i[x]),
                              'item': ds['book_id'].apply(lambda x: x2i[x]),
                              'rating': ds['rating']})

    if not path.exists(output_dir):
        os.makedirs(output_dir)
    processed.to_csv(path.join(output_dir, 'ds.csv'), index=False)
    with open(path.join(output_dir, 'u2i.pickle'), 'wb') as handle:
        pickle.dump(u2i, handle)

    with open(path.join(output_dir, 'x2i.pickle'), 'wb') as handle:
        pickle.dump(x2i, handle)


def book_user_count_filter(ds, book_users_threshold):
    ct = ds.groupby('book_id')['user_id'].count()
    keep_books = ct[ct >= book_users_threshold].index.values
    return ds[ds['book_id'].isin(keep_books)]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Path to goodbooks dataset directory')
    parser.add_argument('--output_dir', required=True,
                        help='Directory to put processed files into')
    parser.add_argument('--book_users_threshold', type=int, required=False, default=15,
                        help='Users per book threshold to filter')
    args = parser.parse_args()
    process_raw(args.input_dir, args.output_dir, args.book_users_threshold)
