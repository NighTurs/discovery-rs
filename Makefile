# Lastfm 360k targets

lastfm_raw: data/raw/lastfm-dataset-360K

data/raw/lastfm-dataset-360K:
	(cd data/raw && wget http://mtg.upf.edu/static/datasets/last.fm/lastfm-dataset-360K.tar.gz && tar xvfz lastfm-dataset-360K.tar.gz)

lastfm_processed: data/processed/lastfm/ds.csv

data/processed/lastfm/ds.csv: data/raw/lastfm-dataset-360K
	python -m scripts.lastfm.process_raw --input data/raw/lastfm-dataset-360K/usersha1-artmbid-artname-plays.tsv --output_dir data/processed/lastfm

lastfm_train_model: fastai/models/model.pth

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
		--hide_pct 0.5 \
		--w_hide_ratio 2.5

lastfm_musicbrainz_data: data/processed/lastfm/musicbrainz.pickle

data/processed/lastfm/musicbrainz.pickle: data/processed/lastfm/ds.csv
	python -m scripts.lastfm.get_musicbrainz_data --input_dir data/processed/lastfm

lastfm_tsne_embedding: data/processed/lastfm/tsne_emb.csv

data/processed/lastfm/tsne_emb.csv: fastai/models/model.pth
	python -m scripts.lastfm.tsne_emb --model fastai/models/model.pth --output_dir data/processed/lastfm

lastfm_rs_recommend: data/processed/lastfm/recommendations.pickle

data/processed/lastfm/recommendations.pickle: fastai/models/model.pth data/processed/lastfm/ds.csv
	python -m scripts.lastfm.rs_recommend \
	--input_dir data/processed/lastfm \
	--model_path fastai/models/model.pth \
	--artist_list data/processed/lastfm/my_list.txt

lastfm_web_data: data/processed/lastfm/web.csv

data/processed/lastfm/web.csv: data/processed/lastfm/ds.csv data/processed/lastfm/tsne_emb.csv data/processed/lastfm/musicbrainz.pickle data/processed/lastfm/recommendations.pickle
	python -m scripts.lastfm.assemble_web_data --input_dir data/processed/lastfm

lastfm_elasticlunr_index: data/processed/lastfm/web_index.json

data/processed/lastfm/web_index.json: data/processed/lastfm/web.csv
	node scripts/indexer.js data/processed/lastfm

lastfm_web_archive: web/data/lastfm.zip

web/data/lastfm.zip: data/processed/lastfm/web.csv data/processed/lastfm/web_index.json
	(cd -- data/processed/lastfm && zip lastfm.zip web.csv web_index.json) && cp data/processed/lastfm/lastfm.zip web/data/

# Movielens targets

ml_raw: data/raw/ml-latest

data/raw/ml-latest:
	(cd data/raw && wget http://files.grouplens.org/datasets/movielens/ml-latest.zip && unzip ml-latest.zip)

ml_processed: data/processed/ml/ds.csv

data/processed/ml/ds.csv: data/raw/ml-latest
	python -m scripts.movielens.process_raw --input_dir data/raw/ml-latest --output_dir data/processed/ml \
		--movie_users_threshold 15

ml_train_model: fastai/models/ml_model.pth

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

ml_tsne_embedding: data/processed/ml/tsne_emb.csv

data/processed/ml/tsne_emb.csv: fastai/models/ml_model.pth
	python -m scripts.movielens.tsne_emb --model fastai/models/ml_model.pth --output_dir data/processed/ml

ml_rs_recommend: data/processed/ml/recommendations.pickle

data/processed/ml/recommendations.pickle: fastai/models/ml_model.pth data/processed/ml/ds.csv
	python -m scripts.movielens.rs_recommend \
	--input_dir data/processed/ml \
	--model_path fastai/models/ml_model.pth \
	--artist_list data/processed/ml/my_list.csv

ml_web_data: data/processed/ml/web.csv

data/processed/ml/web.csv: data/processed/ml/tsne_emb.csv data/processed/ml/recommendations.pickle
	python -m scripts.movielens.assemble_web_data --raw_dir data/raw/ml-latest --processed_dir data/processed/ml

ml_elasticlunr_index: data/processed/ml/web_index.json

data/processed/ml/web_index.json: data/processed/ml/web.csv
	node scripts/indexer.js data/processed/ml

ml_web_archive: web/data/ml.zip

web/data/ml.zip: data/processed/ml/web.csv data/processed/ml/web_index.json
	(cd -- data/processed/ml && zip ml.zip web.csv web_index.json) && cp data/processed/ml/ml.zip web/data/
