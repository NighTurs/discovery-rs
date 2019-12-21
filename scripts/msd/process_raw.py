import argparse
import pickle
import re
import os
import sqlite3
import pandas as pd
from tqdm import tqdm
from os import path
from ..utils import keep_positive_ratings, count_filter


def process_raw(input_dir, output_dir, song_users_threshold, user_songs_threshold):
    if not path.exists(output_dir):
        os.makedirs(output_dir)
    x2i = process_ds(input_dir, output_dir,
                     song_users_threshold, user_songs_threshold)
    process_info(input_dir, output_dir, x2i)


def process_ds(input_dir, output_dir, song_users_threshold, user_songs_threshold):
    ds = pd.read_csv(path.join(input_dir, 'train_triplets.txt'), header=None, names=[
        'userId', 'songId', 'playcount'], sep='\t')

    p = re.compile('SO[A-Z0-9]{16}')
    with open(path.join(input_dir, 'sid_mismatches.txt'), 'r') as f:
        bad = [p.search(l).group() for l in f.readlines()]

    ds = ds[~ds['songId'].isin(bad)]

    print('Overall records:', ds.shape[0])
    print('Overall users:', len(ds['userId'].unique()))
    print('Overall songs:', len(ds['songId'].unique()))

    ds = count_filter(ds, song_users_threshold, 'songId', 'userId')
    ds = count_filter(ds, user_songs_threshold, 'userId', 'songId')

    print('Left records:', ds.shape[0])
    print('Left users:', len(ds['userId'].unique()))
    print('Left songs:', len(ds['songId'].unique()))

    u2i = {user: ind for ind, user in enumerate(ds['userId'].unique())}
    x2i = {song: ind for ind, song in enumerate(ds['songId'].unique())}

    processed = pd.DataFrame({'user': ds['userId'].apply(lambda x: u2i[x]),
                              'item': ds['songId'].apply(lambda x: x2i[x])})

    processed.to_csv(path.join(output_dir, 'ds.csv'), index=False)

    with open(path.join(output_dir, 'u2i.pickle'), 'wb') as handle:
        pickle.dump(u2i, handle)

    with open(path.join(output_dir, 'x2i.pickle'), 'wb') as handle:
        pickle.dump(x2i, handle)

    return x2i


def process_info(input_dir, output_dir, x2i):
    songs = pd.read_csv(path.join(input_dir, 'unique_tracks.txt'), header=None, names=[
                        'trackId', 'songId', 'artist', 'song'], sep='<SEP>', engine='python')
    songs = songs[songs['songId'].isin(x2i)]
    songs = songs.drop_duplicates('songId')
    notfound = 0
    rows = []
    with sqlite3.connect(path.join(input_dir, 'track_metadata.db')) as track_conn, \
            sqlite3.connect(path.join(input_dir, 'artist_term.db')) as artist_conn:
        cur_track = track_conn.cursor()
        cur_artist = artist_conn.cursor()
        for song in tqdm(songs.itertuples()):
            if song.songId not in x2i:
                continue
            cur_track.execute('''select artist_id, artist_name, release, title, duration, 
                            artist_familiarity, artist_hotttnesss, year from songs where track_id = ?''',
                              (song.trackId,))
            res = cur_track.fetchall()
            if len(res) == 0:
                notfound += 1
                continue
            cur_artist.execute(
                'select mbtag from artist_mbtag where artist_id = ?', (res[0][0],))
            res = [x2i[song.songId]] + [*res[0][1:]] + \
                [', '.join([x[0] for x in cur_artist.fetchall()])]
            rows.append(res)
    print('Info not found: ', notfound)
    info = pd.DataFrame(rows, columns=['item', 'artist', 'release', 'title',
                                       'duration', 'artist_familiarity', 'artist_hotness', 'year', 'tags'])
    info = info.sort_values('item')
    info.to_csv(path.join(output_dir, 'info.csv'), index=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Path to MSD dataset directory')
    parser.add_argument('--output_dir', required=True,
                        help='Directory to put processed files into')
    parser.add_argument('--song_users_threshold', type=int, required=False, default=200,
                        help='Users per song threshold to filter')
    parser.add_argument('--user_songs_threshold', type=int, required=False, default=20,
                        help='Songs per user threshold to filter')
    args = parser.parse_args()

    process_raw(args.input_dir, args.output_dir,
                args.song_users_threshold, args.user_songs_threshold)
