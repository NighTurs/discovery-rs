# Lastfm 360k targets

lastfm_raw: data/raw/lastfm-dataset-360K

data/raw/lastfm-dataset-360K:
	(cd data/raw && wget http://mtg.upf.edu/static/datasets/last.fm/lastfm-dataset-360K.tar.gz && tar xvfz lastfm-dataset-360K.tar.gz)

lastfm_processed: data/processed/lastfm/ds.csv

data/processed/lastfm/ds.csv: data/raw/lastfm-dataset-360K
	python -m scripts.lastfm.process_raw --input data/raw/lastfm-dataset-360K/usersha1-artmbid-artname-plays.tsv --output_dir data/processed/lastfm

lastfm_train_model: models/lastfm_epoch_30.model

models/lastfm_epoch_30.model: data/processed/lastfm/ds.csv
	python -m scripts.train_rs \
		--input_dir data/processed/lastfm \
		--model_path models/lastfm \
		--lr 1e-3 \
		--lr_milestones 20 27 \
		--wd 3e-4 \
		--epochs 30 \
		--emb_size 200 \
		--batch_size 500 \
		--wo_eval

lastfm_musicbrainz_data: data/processed/lastfm/musicbrainz.pickle

data/processed/lastfm/musicbrainz.pickle: data/processed/lastfm/ds.csv
	python -m scripts.lastfm.get_musicbrainz_data --input_dir data/processed/lastfm

lastfm_tsne_embedding: data/processed/lastfm/tsne_emb.csv

data/processed/lastfm/tsne_emb.csv: models/lastfm_epoch_30.model
	python -m scripts.tsne_emb \
	--model models/lastfm_epoch_30.model \
	--layer_name de_embedding_layer.weight \
	--perplexities 50 500 \
	--lr 1000 \
	--n_iter 3000 \
	--output_dir data/processed/lastfm

lastfm_rs_recommend: data/processed/lastfm/recommendations.pickle

data/processed/lastfm/recommendations.pickle: models/lastfm_epoch_30.model data/processed/lastfm/ds.csv
	python -m scripts.rs_recommend \
	--input_dir data/processed/lastfm \
	--model_path models/lastfm_epoch_30.model \
	--item_list data/processed/lastfm/my_list.csv

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
		--movie_users_threshold 5 --user_movies_threshold 5

ml_train_model: models/ml_epoch_100.model

models/ml_epoch_100.model: data/processed/ml/ds.csv
	python -m scripts.train_rs \
		--input_dir data/processed/ml \
		--model_path models/ml \
		--lr 1e-3 \
		--lr_milestones 60 80 \
		--wd 2e-5 \
		--epochs 100 \
		--emb_size 200 \
		--batch_size 500 \
		--wo_eval

ml_tsne_embedding: data/processed/ml/tsne_emb.csv

data/processed/ml/tsne_emb.csv: models/ml_epoch_100.model
	python -m scripts.tsne_emb \
	--model models/ml_epoch_100.model \
	--layer_name de_embedding_layer.weight \
	--perplexities 50 500 \
	--lr 1000 \
	--n_iter 1500 \
	--output_dir data/processed/ml

ml_rs_recommend: data/processed/ml/recommendations.pickle

data/processed/ml/recommendations.pickle: models/ml_epoch_100.model data/processed/ml/ds.csv
	python -m scripts.rs_recommend \
	--input_dir data/processed/ml \
	--model_path models/ml_epoch_100.model \
	--item_list data/processed/ml/my_list.csv

ml_web_data: data/processed/ml/web.csv

data/processed/ml/web.csv: data/processed/ml/tsne_emb.csv data/processed/ml/recommendations.pickle
	python -m scripts.movielens.assemble_web_data \
	--raw_dir data/raw/ml-latest \
	--processed_dir data/processed/ml

ml_elasticlunr_index: data/processed/ml/web_index.json

data/processed/ml/web_index.json: data/processed/ml/web.csv
	node scripts/indexer.js data/processed/ml

ml_web_archive: web/data/ml.zip

web/data/ml.zip: data/processed/ml/web.csv data/processed/ml/web_index.json
	(cd -- data/processed/ml && zip ml.zip web.csv web_index.json) && cp data/processed/ml/ml.zip web/data/

# Goodbooks 10k

gbook_raw: data/raw/goodbooks-10k

data/raw/goodbooks-10k:
	(cd data/raw && wget https://github.com/zygmuntz/goodbooks-10k/releases/download/v1.0/goodbooks-10k.zip && unzip goodbooks-10k.zip -d goodbooks-10k)

gbook_processed: data/processed/gbook/ds.csv

data/processed/gbook/ds.csv: data/raw/goodbooks-10k
	python -m scripts.goodbooks.process_raw --input_dir data/raw/goodbooks-10k --output_dir data/processed/gbook \
		--book_users_threshold 5 --user_books_threshold 5

gbook_train_model: models/gbook_epoch_100.model

models/gbook_epoch_100.model: data/processed/gbook/ds.csv
	python -m scripts.train_rs \
		--input_dir data/processed/gbook \
		--model_path models/gbook \
		--lr 1e-3 \
		--lr_milestones 60 80 \
		--wd 2e-5 \
		--epochs 100 \
		--emb_size 200 \
		--batch_size 500 \
		--wo_eval

gbook_tsne_embedding: data/processed/gbook/tsne_emb.csv

data/processed/gbook/tsne_emb.csv: models/gbook_epoch_100.model
	python -m scripts.tsne_emb \
	--model models/gbook_epoch_100.model \
	--layer_name de_embedding_layer.weight \
	--perplexities 20 200 \
	--lr 1000 \
	--n_iter 1500 \
	--output_dir data/processed/gbook

gbook_rs_recommend: data/processed/gbook/recommendations.pickle

data/processed/gbook/recommendations.pickle: models/gbook_epoch_100.model data/processed/gbook/ds.csv
	python -m scripts.rs_recommend \
	--input_dir data/processed/gbook \
	--model_path models/gbook_epoch_100.model \
	--item_list data/processed/gbook/my_list.csv

gbook_web_data: data/processed/gbook/web.csv

data/processed/gbook/web.csv: data/processed/gbook/tsne_emb.csv data/processed/gbook/recommendations.pickle
	python -m scripts.goodbooks.assemble_web_data --raw_dir data/raw/goodbooks-10k --processed_dir data/processed/gbook

gbook_elasticlunr_index: data/processed/gbook/web_index.json

data/processed/gbook/web_index.json: data/processed/gbook/web.csv
	node scripts/indexer.js data/processed/gbook

gbook_web_archive: web/data/gbook.zip

web/data/gbook.zip: data/processed/gbook/web.csv data/processed/gbook/web_index.json
	(cd -- data/processed/gbook && zip gbook.zip web.csv web_index.json) && cp data/processed/gbook/gbook.zip web/data/