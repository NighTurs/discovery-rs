raw_lastfm_360k: data/raw/lastfm-dataset-360K

data/raw/lastfm-dataset-360K:
	(cd data/raw && wget http://mtg.upf.edu/static/datasets/last.fm/lastfm-dataset-360K.tar.gz && tar xvfz lastfm-dataset-360K.tar.gz)

process_lastfm_360k: data/processed/lastfm/ds.csv

data/processed/lastfm/ds.csv:
	python -m scripts.lastfm.process_raw --input data/raw/lastfm-dataset-360K/usersha1-artmbid-artname-plays.tsv --output_dir data/processed/lastfm