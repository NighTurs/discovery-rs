PYTHON = python -m
NODE = node
RAW_DIR = data/raw
PROCESSED_DIR = data/processed
MODEL_DIR = models
WEB_DATA_DIR = web/data
DS = ds.csv
EMBED_LAYER = de_embedding_layer.weight
TSNE = tsne_emb.csv
RECS = recommendations.pickle
WEB = web.csv
INDEX = web_index.json
REC_ITEMS = rec_items.csv

LF_360K_URL = http://mtg.upf.edu/static/datasets/last.fm/lastfm-dataset-360K.tar.gz
LF_SHORT = lf
LF_RAW_DIR = ${RAW_DIR}/lastfm-dataset-360K
LF_PROC_DIR = ${PROCESSED_DIR}/${LF_SHORT}
LF_MODEL = ${MODEL_DIR}/${LF_SHORT}_epoch_30.model
LF_ZIP = ${LF_SHORT}.zip

ML_LATEST_URL = http://files.grouplens.org/datasets/movielens/ml-latest.zip
ML_SHORT = ml
ML_RAW_DIR = ${RAW_DIR}/ml-latest
ML_PROC_DIR = ${PROCESSED_DIR}/${ML_SHORT}
ML_MODEL = ${MODEL_DIR}/${ML_SHORT}_epoch_100.model
ML_ZIP = ${ML_SHORT}.zip

GB_10K_URL = https://github.com/zygmuntz/goodbooks-10k/releases/download/v1.0/goodbooks-10k.zip
GB_SHORT = gb
GB_RAW_DIR = ${RAW_DIR}/goodbooks-10k
GB_PROC_DIR = ${PROCESSED_DIR}/${GB_SHORT}
GB_MODEL = ${MODEL_DIR}/${GB_SHORT}_epoch_100.model
GB_ZIP = ${GB_SHORT}.zip

MSD_SHORT = msd
MSD_RAW_DIR = ${RAW_DIR}/msd-taste-profile
MSD_PROC_DIR = ${PROCESSED_DIR}/${MSD_SHORT}
MSD_MODEL = ${MODEL_DIR}/${MSD_SHORT}_epoch_100.model
MSD_ZIP = ${MSD_SHORT}.zip

# Lastfm 360k targets

lf_raw: ${LF_RAW_DIR}

${LF_RAW_DIR}:
	(cd ${RAW_DIR} && wget ${LF_360K_URL} && tar xvfz lastfm-dataset-360K.tar.gz)

lf_processed: ${LF_PROC_DIR}/${DS}

${LF_PROC_DIR}/${DS}: ${LF_RAW_DIR}
	${PYTHON} scripts.lastfm.process_raw \
		--input ${LF_RAW_DIR}/usersha1-artmbid-artname-plays.tsv \
		--output_dir ${LF_PROC_DIR}

lf_train_model: ${LF_MODEL}

${LF_MODEL}: ${LF_PROC_DIR}/${DS}
	${PYTHON} scripts.train_rs \
		--input_dir ${LF_PROC_DIR} \
		--model_path ${MODEL_DIR}/${LF_SHORT} \
		--lr 1e-3 \
		--lr_milestones 20 27 \
		--wd 3e-4 \
		--epochs 30 \
		--emb_size 200 \
		--batch_size 500 \
		--wo_eval

lf_musicbrainz_data: ${LF_PROC_DIR}/musicbrainz.csv

${LF_PROC_DIR}/musicbrainz.csv: ${LF_RAW_DIR}
	${PYTHON} scripts.lastfm.get_musicbrainz_data \
		--input ${LF_RAW_DIR}/usersha1-artmbid-artname-plays.tsv \
		--output_dir ${LF_PROC_DIR} \
		--ntags 6

lf_tsne_embedding: ${LF_PROC_DIR}/${TSNE}

${LF_PROC_DIR}/${TSNE}: ${LF_MODEL}
	${PYTHON} scripts.tsne_emb \
	--model ${LF_MODEL} \
	--layer_name ${EMBED_LAYER} \
	--perplexities 50 500 \
	--lr 1000 \
	--n_iter 3000 \
	--output_dir ${LF_PROC_DIR}

lf_rs_recommend: ${LF_PROC_DIR}/${RECS}

${LF_PROC_DIR}/${RECS}: ${LF_MODEL}
	${PYTHON} scripts.rs_recommend \
	--input_dir ${LF_PROC_DIR} \
	--model_path ${LF_MODEL} \
	--item_list ${LF_PROC_DIR}/${REC_ITEMS}

lf_web_data: ${LF_PROC_DIR}/${WEB}

${LF_PROC_DIR}/${WEB}: ${LF_PROC_DIR}/${TSNE} ${LF_PROC_DIR}/musicbrainz.csv ${LF_PROC_DIR}/${RECS}
	${PYTHON} scripts.lastfm.assemble_web_data --input_dir ${LF_PROC_DIR}

lf_search_index: ${LF_PROC_DIR}/${INDEX}

${LF_PROC_DIR}/${INDEX}: ${LF_PROC_DIR}/${WEB}
	${NODE} scripts/indexer.js ${LF_PROC_DIR}

lf_web_archive: ${WEB_DATA_DIR}/${LF_ZIP}

${WEB_DATA_DIR}/${LF_ZIP}: ${LF_PROC_DIR}/${WEB} ${LF_PROC_DIR}/${INDEX}
	(cd -- ${LF_PROC_DIR} && zip ${LF_ZIP} ${WEB} ${INDEX}) && cp ${LF_PROC_DIR}/${LF_ZIP} ${WEB_DATA_DIR}

# Movielens targets

ml_raw: ${ML_RAW_DIR}

${ML_RAW_DIR}:
	(cd ${RAW_DIR} && wget ${ML_LATEST_URL} && unzip ml-latest.zip)

ml_processed: ${ML_PROC_DIR}/${DS}

${ML_PROC_DIR}/${DS}: ${ML_RAW_DIR}
	${PYTHON} scripts.movielens.process_raw \
		--input_dir ${ML_RAW_DIR} \
		--output_dir ${ML_PROC_DIR} \
		--movie_users_threshold 5 \
		--user_movies_threshold 5

ml_train_model: ${ML_MODEL}

${ML_MODEL}: ${ML_PROC_DIR}/${DS}
	${PYTHON} scripts.train_rs \
		--input_dir ${ML_PROC_DIR} \
		--model_path ${MODEL_DIR}/${ML_SHORT} \
		--lr 1e-3 \
		--lr_milestones 60 80 \
		--wd 2e-5 \
		--epochs 100 \
		--emb_size 200 \
		--batch_size 500 \
		--wo_eval

ml_tsne_embedding: ${ML_PROC_DIR}/${TSNE}

${ML_PROC_DIR}/${TSNE}: ${ML_MODEL}
	${PYTHON} scripts.tsne_emb \
	--model ${ML_MODEL} \
	--layer_name ${EMBED_LAYER} \
	--perplexities 50 500 \
	--lr 1000 \
	--n_iter 1500 \
	--output_dir ${ML_PROC_DIR}

ml_rs_recommend: ${ML_PROC_DIR}/${RECS}

${ML_PROC_DIR}/${RECS}: ${ML_MODEL} ${ML_PROC_DIR}/${DS}
	${PYTHON} scripts.rs_recommend \
	--input_dir ${ML_PROC_DIR} \
	--model_path ${ML_MODEL} \
	--item_list ${ML_PROC_DIR}/${REC_ITEMS}

ml_web_data: ${ML_PROC_DIR}/web.csv

${ML_PROC_DIR}/${WEB}: ${ML_PROC_DIR}/${TSNE} ${ML_PROC_DIR}/${RECS}
	${PYTHON} scripts.movielens.assemble_web_data \
	--raw_dir ${ML_RAW_DIR} \
	--processed_dir ${ML_PROC_DIR}

ml_search_index: ${ML_PROC_DIR}/${INDEX}

${ML_PROC_DIR}/${INDEX}: ${ML_PROC_DIR}/${WEB}
	${NODE} scripts/indexer.js ${ML_PROC_DIR}

ml_web_archive: ${WEB_DATA_DIR}/${ML_ZIP}

${WEB_DATA_DIR}/${ML_ZIP}: ${ML_PROC_DIR}/${WEB} ${ML_PROC_DIR}/${INDEX}
	(cd -- ${ML_PROC_DIR} && zip ${ML_ZIP} ${WEB} ${INDEX}) && cp ${ML_PROC_DIR}/${ML_ZIP} ${WEB_DATA_DIR}

# Goodbooks 10k

gb_raw: ${GB_RAW_DIR}

${GB_RAW_DIR}:
	(cd ${RAW_DIR} && wget ${GB_10K_URL} && unzip goodbooks-10k.zip -d goodbooks-10k)

gb_processed: ${GB_PROC_DIR}/${DS}

${GB_PROC_DIR}/${DS}: ${GB_RAW_DIR}
	${PYTHON} scripts.goodbooks.process_raw \
		--input_dir ${GB_RAW_DIR} \
		--output_dir ${GB_PROC_DIR} \
		--book_users_threshold 5 \
		--user_books_threshold 5

gb_train_model: ${GB_MODEL}

${GB_MODEL}: ${GB_PROC_DIR}/${DS}
	${PYTHON} scripts.train_rs \
		--input_dir ${GB_PROC_DIR} \
		--model_path ${MODEL_DIR}/${GB_SHORT} \
		--lr 1e-3 \
		--lr_milestones 60 80 \
		--wd 2e-5 \
		--epochs 100 \
		--emb_size 200 \
		--batch_size 500 \
		--wo_eval

gb_tsne_embedding: ${GB_PROC_DIR}/${TSNE}

${GB_PROC_DIR}/${TSNE}: ${GB_MODEL}
	${PYTHON} scripts.tsne_emb \
	--model ${GB_MODEL} \
	--layer_name ${EMBED_LAYER} \
	--perplexities 20 200 \
	--lr 1000 \
	--n_iter 1500 \
	--output_dir ${GB_PROC_DIR}

gb_rs_recommend: ${GB_PROC_DIR}/${RECS}

${GB_PROC_DIR}/recommendations.pickle: ${GB_MODEL} ${GB_PROC_DIR}/${DS}
	${PYTHON} scripts.rs_recommend \
	--input_dir ${GB_PROC_DIR} \
	--model_path ${GB_MODEL} \
	--item_list ${GB_PROC_DIR}/${REC_ITEMS}

gb_web_data: ${GB_PROC_DIR}/web.csv

${GB_PROC_DIR}/${WEB}: ${GB_PROC_DIR}/${TSNE} ${GB_PROC_DIR}/${RECS}
	${PYTHON} scripts.goodbooks.assemble_web_data \
		--raw_dir ${GB_RAW_DIR} \
		--processed_dir ${GB_PROC_DIR}

gb_search_index: ${GB_PROC_DIR}/${INDEX}

${GB_PROC_DIR}/${INDEX}: ${GB_PROC_DIR}/${WEB}
	${NODE} scripts/indexer.js ${GB_PROC_DIR}

gb_web_archive: ${WEB_DATA_DIR}/${GB_ZIP}

${WEB_DATA_DIR}/${GB_ZIP}: ${GB_PROC_DIR}/${WEB} ${GB_PROC_DIR}/${INDEX}
	(cd -- ${GB_PROC_DIR} && zip ${GB_ZIP} ${WEB} ${INDEX}) && cp ${GB_PROC_DIR}/${GB_ZIP} ${WEB_DATA_DIR}

# MSD Taste Profile

msd_raw: ${MSD_RAW_DIR}

${MSD_RAW_DIR}:
	mkdir ${MSD_RAW_DIR} && \
	(cd ${MSD_RAW_DIR} && \
	wget http://millionsongdataset.com/sites/default/files/AdditionalFiles/unique_tracks.txt && \
	wget http://millionsongdataset.com/sites/default/files/challenge/train_triplets.txt.zip && \
	wget http://millionsongdataset.com/sites/default/files/tasteprofile/sid_mismatches.txt && \
    unzip train_triplets.txt.zip)

msd_processed: ${MSD_PROC_DIR}/${DS}

${MSD_PROC_DIR}/${DS}: ${MSD_RAW_DIR}
	${PYTHON} scripts.msd.process_raw \
		--input_dir ${MSD_RAW_DIR} \
		--output_dir ${MSD_PROC_DIR} \
		--song_users_threshold 40 \
		--user_songs_threshold 20

msd_train_model: ${MSD_MODEL}

${MSD_MODEL}: ${MSD_PROC_DIR}/${DS}
	${PYTHON} scripts.train_rs \
		--input_dir ${MSD_PROC_DIR} \
		--model_path ${MODEL_DIR}/${MSD_SHORT} \
		--lr 1e-3 \
		--lr_milestones 60 80 \
		--wd 2e-5 \
		--epochs 100 \
		--emb_size 500 \
		--batch_size 500
		# --wo_eval

msd_tsne_embedding: ${MSD_PROC_DIR}/${TSNE}

${MSD_PROC_DIR}/${TSNE}: ${MSD_MODEL}
	${PYTHON} scripts.tsne_emb \
	--model ${MSD_MODEL} \
	--layer_name ${EMBED_LAYER} \
	--perplexities 50 500 \
	--lr 1000 \
	--n_iter 3000 \
	--output_dir ${MSD_PROC_DIR}

msd_rs_recommend: ${MSD_PROC_DIR}/${RECS}

${MSD_PROC_DIR}/recommendations.pickle: ${MSD_MODEL} ${MSD_PROC_DIR}/${DS}
	${PYTHON} scripts.rs_recommend \
	--input_dir ${MSD_PROC_DIR} \
	--model_path ${MSD_MODEL} \
	--item_list ${MSD_PROC_DIR}/${REC_ITEMS}

msd_web_data: ${MSD_PROC_DIR}/web.csv

${MSD_PROC_DIR}/${WEB}: ${MSD_PROC_DIR}/${TSNE} ${MSD_PROC_DIR}/${RECS}
	${PYTHON} scripts.msd.assemble_web_data \
		--processed_dir ${MSD_PROC_DIR}

msd_search_index: ${MSD_PROC_DIR}/${INDEX}

${MSD_PROC_DIR}/${INDEX}: ${MSD_PROC_DIR}/${WEB}
	${NODE} scripts/indexer.js ${MSD_PROC_DIR}

msd_web_archive: ${WEB_DATA_DIR}/${MSD_ZIP}

${WEB_DATA_DIR}/${MSD_ZIP}: ${MSD_PROC_DIR}/${WEB} ${MSD_PROC_DIR}/${INDEX}
	(cd -- ${MSD_PROC_DIR} && zip ${MSD_ZIP} ${WEB} ${INDEX}) && cp ${MSD_PROC_DIR}/${MSD_ZIP} ${WEB_DATA_DIR}

# Recommender server

start_rec_server:
	${PYTHON} scripts.rec_server \
	--port 5501 \
	--ds ${ML_SHORT} ${GB_SHORT} ${LF_SHORT} \
	--models ${ML_MODEL} ${GB_MODEL} ${LF_MODEL}
