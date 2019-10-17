import argparse
import os
import pickle
import pandas as pd
import numpy as np


def process_raw(input, output_dir, playcount_threshold, user_artists_threshold, artist_users_threshold):
    ds = pd.read_csv(input, sep='\t', header=None, names=[
                     'user', 'artist_mbid', 'artist_name', 'playcount'],
                     na_values=[], keep_default_na=False)
    print('Overall records:', ds.shape[0])
    print('Overall users:', len(ds['user'].unique()))
    print('Overall artists:', ds.drop_duplicates(
        subset=['artist_name', 'artist_mbid']).shape[0])

    ds = ds[ds['playcount'] >= playcount_threshold]
    ds = user_artists_count_filter(ds, user_artists_threshold)
    ds = artist_user_count_filter(ds, artist_users_threshold)
    ds = user_artists_count_filter(ds, user_artists_threshold)
    ds = artist_user_count_filter(ds, artist_users_threshold)

    print('Left records:', ds.shape[0])
    print('Left users:', len(ds['user'].unique()))
    print('Left artists:', ds.drop_duplicates(
        subset=['artist_name', 'artist_mbid']).shape[0])

    u2i = {u: i for i, u in enumerate(ds['user'].drop_duplicates())}
    a2i = {(a.artist_name, a.artist_mbid): i for i, a in enumerate(
        ds.drop_duplicates(subset=['artist_name', 'artist_mbid']).itertuples())}

    ua = pd.DataFrame({'user': [u2i[x] for x in ds['user']],
                       'artist': [a2i[(x.artist_name, x.artist_mbid)] for x in ds[['artist_name', 'artist_mbid']].itertuples()],
                       'playcount': ds['playcount']})

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    ua.to_csv(os.path.join(output_dir, 'ds.csv'), index=False)
    with open(os.path.join(output_dir, 'u2i.pickle'), 'wb') as handle:
        pickle.dump(u2i, handle)

    with open(os.path.join(output_dir, 'a2i.pickle'), 'wb') as handle:
        pickle.dump(a2i, handle)


def user_artists_count_filter(ds, user_artists_threshold):
    ct = ds.groupby('user')['playcount'].count()
    keep_users = ct[ct >= user_artists_threshold].index.values
    return ds[ds['user'].isin(keep_users)]


def artist_user_count_filter(ds, artist_users_threshold):
    ct = ds.groupby(['artist_name', 'artist_mbid'])['playcount'].count()
    keep_artists = ct[ct >= artist_users_threshold].index.to_frame(index=False)
    return pd.merge(ds, keep_artists, how='inner', on=['artist_name', 'artist_mbid'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True,
                        help='Path to 350K Lastfm tsv')
    parser.add_argument('--output_dir', required=True,
                        help='Directory to put processed files into')
    parser.add_argument('--playcount_threshold', type=int, required=False, default=40,
                        help='Record playcount threshold to filter')
    parser.add_argument('--user_artists_threshold', type=int, required=False, default=20,
                        help='Artists per user threshold to filter')
    parser.add_argument('--artist_users_threshold', type=int, required=False, default=20,
                        help='Users per artist threshold to filter')
    args = parser.parse_args()
    process_raw(args.input, args.output_dir, args.playcount_threshold,
                args.user_artists_threshold, args.artist_users_threshold)
