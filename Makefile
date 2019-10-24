# Lastfm 360k targets

raw_lastfm_360k: data/raw/lastfm-dataset-360K

data/raw/lastfm-dataset-360K:
	(cd data/raw && wget http://mtg.upf.edu/static/datasets/last.fm/lastfm-dataset-360K.tar.gz && tar xvfz lastfm-dataset-360K.tar.gz)

processed_lastfm_360k: data/processed/lastfm/ds.csv

data/processed/lastfm/ds.csv: data/raw/lastfm-dataset-360K
	python -m scripts.lastfm.process_raw --input data/raw/lastfm-dataset-360K/usersha1-artmbid-artname-plays.tsv --output_dir data/processed/lastfm

train_lastfm_360k_model: fastai/models/model.pth

fastai/models/model.pth: data/processed/lastfm/ds.csv
	python -m scripts.lastfm.train_rs \
		--input_dir data/processed/lastfm \
		--model_name model \
		--w_neg 0.5 \
		--lr 0.001 \
		--wd 3e-08 \
		--epochs 4 \
		--emb_size 700 \
		--batch_size 256 \
		--mask_pct 0.5 \
		--w_mask_ratio 2.5

musicbrainz_data: data/processed/lastfm/musicbrainz.pickle

data/processed/lastfm/musicbrainz.pickle: data/processed/lastfm/ds.csv
	python -m scripts.lastfm.get_musicbrainz_data --input_dir data/processed/lastfm

tsne_embedding: data/processed/lastfm/tsne_emb.csv

data/processed/lastfm/tsne_emb.csv: fastai/models/model.pth
	python -m scripts.lastfm.tsne_emb --model fastai/models/model.pth --output_dir data/processed/lastfm

rs_recommend: data/processed/lastfm/recommendations.pickle

data/processed/lastfm/recommendations.pickle: fastai/models/model.pth data/processed/lastfm/ds.csv
	python -m scripts.lastfm.rs_recommend \
	--input_dir data/processed/lastfm \
	--model_path fastai/models/model.pth \
	--artist_list data/processed/lastfm/my_list.txt

web_data: data/processed/lastfm/web.csv

data/processed/lastfm/web.csv: data/processed/lastfm/ds.csv data/processed/lastfm/tsne_emb.csv data/processed/lastfm/musicbrainz.pickle data/processed/lastfm/recommendations.pickle
	python -m scripts.lastfm.assemble_web_data --input_dir data/processed/lastfm

elasticlunr_index: data/processed/lastfm/web_index.json

data/processed/lastfm/web_index.json: data/processed/lastfm/web.csv
	node scripts/indexer.js

lastfm_web_archive: web/data/lastfm.zip

web/data/lastfm.zip: data/processed/lastfm/web.csv data/processed/lastfm/web_index.json
	(cd -- data/processed/lastfm && zip lastfm.zip web.csv web_index.json) && cp data/processed/lastfm/lastfm.zip web/data/

# Movielens targets

raw_ml: data/raw/ml-latest

data/raw/ml-latest:
	(cd data/raw && wget http://files.grouplens.org/datasets/movielens/ml-latest.zip && unzip ml-latest.zip)

processed_ml: data/processed/ml/ds.csv

data/processed/ml/ds.csv: data/raw/ml-latest
	python -m scripts.movielens.process_raw --input_dir data/raw/ml-latest --output_dir data/processed/ml

train_ml_model: fastai/models/ml_model.pth

fastai/models/ml_model.pth: data/processed/ml/ds.csv
	python -m scripts.movielens.train_rs \
		--input_dir data/processed/ml \
		--model_name ml_model \
		--lr 0.001 \
		--wd 0.07 \
		--epochs 30 \
		--emb_size 500 \
		--batch_movies 5000 \
		--mem_limit 20000000 \
		--hide_pct 0.3 \
		--w_hide_ratio 2.5
