raw_lastfm_360k: data/raw/lastfm-dataset-360K

data/raw/lastfm-dataset-360K:
	(cd data/raw && wget http://mtg.upf.edu/static/datasets/last.fm/lastfm-dataset-360K.tar.gz && tar xvfz lastfm-dataset-360K.tar.gz)

processed_lastfm_360k: data/processed/lastfm/ds.csv

data/processed/lastfm/ds.csv: raw_lastfm_360k
	python -m scripts.lastfm.process_raw --input data/raw/lastfm-dataset-360K/usersha1-artmbid-artname-plays.tsv --output_dir data/processed/lastfm

train_lastfm_360k_model: processed_lastfm_360k
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