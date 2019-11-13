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


def train_rs(input_dir, model_path, lr, lr_milestones, wd, epochs, emb_size, batch_size, wo_eval):
    print('Reading data...')
    ds = pd.read_csv(path.join(input_dir, 'ds.csv'))
    ds['inter'] = 1

    if wo_eval:
        train = ds
    else:
        print('Train test split...')
        train, valid = train_test_split(ds)
        valid_t, valid_e = train_eval_split(valid)
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

    if not wo_eval:
        val_t_matrix, _, user_id_map = dataframe_to_csr_matrix(valid_t, item_id_map=item_identity,
                                                               **common_params)
        val_e_matrix, _, _ = dataframe_to_csr_matrix(valid_e, item_id_map=item_identity,
                                                     user_id_map=user_id_map, **common_params)
        valid_dataset = RecommendationDataset(val_t_matrix, val_e_matrix)
        del valid_t, valid_e
    else:
        valid_dataset = None

    use_cuda = True

    print('Training model...')

    model = DynamicAutoencoder(hidden_layers=[emb_size], activation_type='tanh',
                               noise_prob=0.5, sparse=False)

    trainer = Recoder(model=model, use_cuda=use_cuda, optimizer_type='adam',
                      loss='logistic', user_based=False)

    metrics = [Recall(k=20, normalize=True), Recall(k=50, normalize=True),
               NDCG(k=100)]

    trainer.train(train_dataset=train_dataset, val_dataset=valid_dataset,
                  batch_size=batch_size, lr=lr, weight_decay=wd,
                  num_epochs=epochs, negative_sampling=True,
                  lr_milestones=lr_milestones, num_data_workers=mp.cpu_count(),
                  model_checkpoint_prefix=model_path,
                  checkpoint_freq=10, eval_num_recommendations=100,
                  metrics=metrics, eval_freq=10)
    trainer.save_state(model_path)


def train_eval_split(ds, eval_prop=0.2):
    t = []
    e = []
    np.random.seed(101)
    for _, group in ds.groupby('user'):
        idx = np.random.permutation(group.index)
        cutoff = int(group.shape[0] * eval_prop)
        t.append(group.loc[idx][:-cutoff])
        e.append(group.loc[idx][-cutoff:])
    return pd.concat(t), pd.concat(e)


def train_test_split(ds):
    np.random.seed(100)
    users = ds['user'].unique()
    split = len(users) * 9 // 10
    idx = np.random.permutation(users)
    train = ds[ds['user'].isin(idx[:split])]
    valid = ds[ds['user'].isin(idx[split:])]
    train_items = pd.unique(train['item'])
    valid = valid[valid['item'].isin(train_items)]
    return train, valid


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Directory with processed dataset')
    parser.add_argument('--model_path', required=True,
                        help='Resulting model file name')
    parser.add_argument('--lr', type=float, required=True,
                        help='Learning rate')
    parser.add_argument('--lr_milestones', type=int, nargs='+', required=True,
                        help='Learning rate milestones')
    parser.add_argument('--wd', type=float, required=True,
                        help='Weight decay')
    parser.add_argument('--epochs', type=int, required=True,
                        help='Number of epochs')
    parser.add_argument('--emb_size', type=int, required=True,
                        help='Embedding size')
    parser.add_argument('--batch_size', type=int, required=True,
                        help='Batch size')
    parser.add_argument('--wo_eval', dest='wo_eval', action='store_true',
                        help="Should train on full dataset without evaluation?")
    parser.set_defaults(wo_eval=False)

    args = parser.parse_args()
    train_rs(args.input_dir, args.model_path, args.lr, args.lr_milestones,
             args.wd, args.epochs, args.emb_size, args.batch_size, args.wo_eval)
