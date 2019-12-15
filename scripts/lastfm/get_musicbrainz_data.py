import argparse
import psycopg2
import pandas as pd
import numpy as np
from tqdm import tqdm
from os import path
from uuid import UUID


def get_musicbrainz_data(input, output_dir, ntags):
    mbids = pd.read_csv(input, sep='\t', header=None, usecols=[1])
    mbids = mbids.loc[:, 1].dropna().unique()
    notFound = 0
    badMBIDs = 0
    rows = []
    with psycopg2.connect(user="musicbrainz", password="musicbrainz", host="127.0.0.1", port="15432") as conn:
        cur = conn.cursor()
        for mbid in tqdm(mbids):
            try:
                UUID(mbid).version
            except ValueError:
                badMBIDs += 1
                continue
            cur.execute('''select a.gid, a.name, c.name, a.begin_date_year, a.end_date_year 
                    from artist a left join area c on c.id = a.area where a.gid = %s''',
                        (mbid.strip(),))
            res = cur.fetchall()
            if len(res) == 0:
                notFound += 1
                continue
            cur.execute('''select t.name from artist a 
                            right join artist_tag at on at.artist = a.id 
                            right join tag t on t.id = at.tag where a.gid = %s 
                            order by at.count desc limit {}'''.format(ntags), (mbid.strip(),))
            res = [*res[0]] + [', '.join([x[0] for x in cur.fetchall()])]
            rows.append(res)
    print('MBIDs not found ', notFound)
    print('Bad MBIDs ', badMBIDs)
    df = pd.DataFrame(
        rows, columns=['mbid', 'name', 'country', 'founded', 'dissolved', 'tags'])
    df.to_csv(path.join(output_dir, 'musicbrainz.csv'),
              index=False, float_format='%.0f')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True,
                        help='Path to 350K Lastfm tsv')
    parser.add_argument('--output_dir', required=True,
                        help='Directory to put processed files into')
    parser.add_argument('--ntags', type=int, required=True,
                        help='Number of tags to keep')
    args = parser.parse_args()
    get_musicbrainz_data(args.input, args.output_dir, args.ntags)
