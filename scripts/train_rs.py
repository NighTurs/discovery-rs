import shutil
import json
import argparse
import pandas as pd
import numpy as np
import multiprocessing as mp
from os import path
from recoder.model import Recoder
from recoder.data import RecommendationDataset
from recoder.metrics import Recall, NDCG
from recoder.nn import DynamicAutoencoder
from recoder.utils import dataframe_to_csr_matrix
from typing import List

from scripts.config import params


def train_rs(proc_dir: str,
             model_dir: str,
             model_name: str,
             lr: float,
             lr_milestones: List[int],
             wd: float,
             epochs: int,
             emb_size: int,
             batch_size: int,
             valid_users_pct: float,
             valid_items_pct: float,
             wo_eval: bool):
    print('Reading data...')
    ds = pd.read_csv(path.join(proc_dir, 'ds.csv'))
    ds['inter'] = 1

    if wo_eval:
        train = ds
    else:
        print('Train test split...')
        train, valid = train_test_split(ds, valid_users_pct)
        valid_t, valid_e = train_eval_split(valid, valid_items_pct)
        del valid
    del ds

    print('Making sparse matrices...')

    item_identity = {i: i for i in train['item']}
    common_params = {
        'user_col': 'user',
        'item_col': 'item',
        'inter_col': 'inter',
    }

    train_matrix, _, _ = dataframe_to_csr_matrix(
        train, item_id_map=item_identity, **common_params)
    train_dataset = RecommendationDataset(train_matrix)
    del train

    if wo_eval:
        valid_dataset = None
    else:
        # noinspection PyUnboundLocalVariable
        val_t_matrix, _, user_id_map = dataframe_to_csr_matrix(valid_t, item_id_map=item_identity,
                                                               **common_params)
        # noinspection PyUnboundLocalVariable
        val_e_matrix, _, _ = dataframe_to_csr_matrix(valid_e, item_id_map=item_identity,
                                                     user_id_map=user_id_map, **common_params)
        valid_dataset = RecommendationDataset(val_t_matrix, val_e_matrix)
        del valid_t, valid_e
    use_cuda = True

    print('Training model...')

    model = DynamicAutoencoder(hidden_layers=[emb_size], activation_type='tanh',
                               noise_prob=0.5, sparse=False)

    trainer = Recoder(model=model, use_cuda=use_cuda, optimizer_type='adam',
                      loss='logistic', user_based=False)

    metrics = [Recall(k=20, normalize=True), Recall(k=50, normalize=True),
               NDCG(k=100)]

    model_prefix = path.join(model_dir, model_name)
    eval_num_recs = 100
    trainer.train(train_dataset=train_dataset, val_dataset=valid_dataset,
                  batch_size=batch_size, lr=lr, weight_decay=wd,
                  num_epochs=epochs, negative_sampling=True,
                  lr_milestones=lr_milestones, num_data_workers=mp.cpu_count(),
                  model_checkpoint_prefix=model_prefix,
                  checkpoint_freq=0, eval_num_recommendations=eval_num_recs,
                  metrics=metrics, eval_freq=5)

    actual_path = "{}_epoch_{}.model".format(model_prefix, epochs)
    shutil.move(actual_path, model_prefix + '.model')

    results = trainer._evaluate(valid_dataset, eval_num_recs, metrics, batch_size)

    with open(model_prefix + '_metrics.json', 'w') as f:
        json.dump({str(metric): np.mean(results[metric]) for metric in metrics}, f)


def train_eval_split(ds, valid_items_pct):
    t = []
    e = []
    np.random.seed(101)
    for _, group in ds.groupby('user'):
        idx = np.random.permutation(group.index)
        cutoff = int(group.shape[0] * valid_items_pct)
        t.append(group.loc[idx][:-cutoff])
        e.append(group.loc[idx][-cutoff:])
    return pd.concat(t), pd.concat(e)


def train_test_split(ds, valid_users_pct):
    np.random.seed(100)
    users = ds['user'].unique()
    split = int(len(users) * (1 - valid_users_pct))
    idx = np.random.permutation(users)
    train = ds[ds['user'].isin(idx[:split])]
    valid = ds[ds['user'].isin(idx[split:])]
    train_items = pd.unique(train['item'])
    valid = valid[valid['item'].isin(train_items)]
    return train, valid


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--domain', required=True,
                        help='Short name of data domain, e.g. lf for last.fm')

    args = parser.parse_args()
    p = params[args.domain]
    pt = p['train_rs']
    train_rs(proc_dir=p['common']['proc_dir'],
             model_dir=params['models_dir'],
             model_name=args.domain,
             lr=float(pt['lr']),
             lr_milestones=[int(x) for x in pt['lr_milestones']],
             wd=float(pt['wd']),
             epochs=int(pt['epochs']),
             emb_size=int(pt['emb_size']),
             batch_size=int(pt['batch_size']),
             valid_users_pct=float(pt['valid_users_pct']),
             valid_items_pct=float(pt['valid_items_pct']),
             wo_eval=False)
