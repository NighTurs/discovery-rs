# Discovery-RS

 > Discovery-RS is a visualization based recommender system with a goal of providing more information than typical top N recommendations lists can.


**Demo:** https://nighturs.github.io/discovery-rs/

Demo has static recommendations for music, books and movies. [Run recommender server locally](#getting-recommendations) to get your own recommendations. 

Public datasets involved:

- Music artists - [Last.fm dataset 360K](http://ocelma.net/MusicRecommendationDataset/lastfm-360K.html)
- Music tracks - [Million Songs Dataset Taste Profile](http://millionsongdataset.com/tasteprofile/)
- Movies - [MovieLens Latest (9/2018)](https://grouplens.org/datasets/movielens/latest)
- Books - [Goodbooks-10k](http://fastml.com/goodbooks-10k-a-new-dataset-for-book-recommendations/)

![discovery-rs.jpg](https://raw.githubusercontent.com/NighTurs/discovery-rs/gh-pages/discovery-rs.jpg)

## Technical details

Project can be viewed as two separate components:

1. Recommendation model and preparation of visualization data
2. Web application

First component can be changed to something that provides csv with following requirements ([example](https://raw.githubusercontent.com/NighTurs/discovery-rs/gh-pages/data/gb.zip)):

1. "idx" column, integers from 0 to N without gaps.
2. "x", "y" columns, float coordinates.
3. "t_name", title of tooltip.
4. Any number of "t_" prefixed string columns to be used in search.
5. Any number of "n_" prefixed float [0, 1] columns to be used for colors and filtering.

And recommender server with api as in [rec_server.py](scripts/rec_server.py). Without server, web application can be used as visualization tool.

Currently first component is a variational autoencoder implicit collaborative filtering model trained with [Recoder](https://github.com/amoussawi/recoder). T-SNE is run on latent factors to get two dimmentional coordinates. Based on dataset, additional information is attached to each item.

Web application is a static page that uses WebGL (three.js) for smooth visualization of scatter plot with thousands of points. In-memory seach engine is provided by [MiniSearch](https://github.com/lucaong/minisearch).

## Getting recommendations

Recommender server has to be run locally. First install python requirements (working on python 3.7):

```bash
pip install -r requirements.txt
```

Donwload models from [here](https://drive.google.com/open?id=1bh6uWk7h2anGRXcHYVswpJXv_CnbyJWV) and place them in "models" directory. Then run:

```bash
make start_rec_server
```

Now use "Flag" section to get recommendations. Fill in "Name" input and double click items that recommendations will be based on. Then press "Send Flag" to get recommendations. Flags are saved in browser local storage, so will be preserved.

Alternatively static recommendations can be obtained by modifying [rec_items.csv](data/processed/lf/rec_items.csv) and [reproducing demo](#reproducing-demo).

## Reproducing demo

Install requirements:

```bash
pip install -r requirements.txt
npm install
```

Then run:

```bash
make lf_web_archive ml_web_archive gb_web_archive msd_web_archive
```

**Note** that Last.fm dataset processing uses local MusicBrainz database. To avoid setting it up, musicbrainz.csv can be downloaded from [here](https://drive.google.com/open?id=1bh6uWk7h2anGRXcHYVswpJXv_CnbyJWV). Then to avoid remaking it:

```bash
make -t data/processed/lf/musicbrainz.csv
```