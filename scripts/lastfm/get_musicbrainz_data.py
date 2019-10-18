import argparse
import musicbrainzngs
import pickle
from os import path
from tqdm import tqdm


def get_musicbrainz_data(input_dir):
    n_tags_to_keep = 6
    with open(path.join(input_dir, 'a2i.pickle'), 'rb') as handle:
        a2i = pickle.load(handle)
    musicbrainzngs.set_useragent('discovery-rs', '0.1', contact=None)
    data = dict()
    for a, i in tqdm(a2i.items()):
        mbid = a[1]
        data[i] = {'tags': [], 'country': '', 'founded': '', 'dissolved': ''}
        if mbid == '':
            print('here')
            continue
        try:
            result = musicbrainzngs.get_artist_by_id(mbid, includes=['tags'])
        except Exception as exc:
            print("Error on request, artist={}, id={}, error={}".format(a, i, exc))
        else:
            artist = result["artist"]
            if 'area' in artist and 'name' in artist['area']:
                data[i]['country'] = artist['area']['name']
            if 'tag-list' in artist:
                tags = artist['tag-list']
                tags = list(filter(lambda x: int(x['count']) > 0, tags))
                tags = sorted(tags,
                              key=lambda x: int(x['count']), reverse=True)
                data[i]['tags'] = [x['name'] for x in tags[:n_tags_to_keep]]
            if 'life-span' in artist:
                if 'begin' in artist['life-span']:
                    data[i]['founded'] = artist['life-span']['begin']
                if 'end' in artist['life-span']:
                    data[i]['dissolved'] = artist['life-span']['end']
        if (len(data) % 100 == 99):
            print('Saving data, len={}'.format(len(data)))
            save_data(input_dir, data)
    save_data(input_dir, data)


def save_data(output_dir, data):
    with open(path.join(output_dir, 'musicbrainz.pickle'), 'wb') as handle:
        pickle.dump(data, handle)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Directory with processed Lastfm 350K dataset')
    args = parser.parse_args()
    get_musicbrainz_data(args.input_dir)
