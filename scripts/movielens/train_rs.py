import argparse
import pickle
import random
import math
import pandas as pd
import numpy as np
from os import path
import torch
import torch.nn as nn
import torch.nn.init as init
from torch.nn.utils.rnn import pad_sequence
from torch.utils.data import Dataset
from torch.utils.data import DataLoader
from fastai.basic_data import *
from fastai.basic_train import *
from fastai.train import *
from fastai.callback import *
from fastai.core import *
from fastai.torch_core import *
from fastai.text.data import SortSampler
from fastai.text.data import SortishSampler


class TrainDataset(Dataset):
    def __init__(self, ds, hide_pct=0.5, w_hide_ratio=1):
        self.w_rest = 1 / ((1 - hide_pct) + hide_pct * w_hide_ratio)
        self.w_hide = self.w_rest * w_hide_ratio
        self.ds = ds
        self.hide_pct = hide_pct

    def __getitem__(self, index):
        x_movie = self.ds.iat[index, 0]  # movie_t
        x_rating = self.ds.iat[index, 1]  # rating_t
        valid_movie = self.ds.iat[index, 2]  # movie_v
        if not isinstance(valid_movie, np.ndarray):
            valid_movie = np.array([], dtype=np.int64)

        all_len = len(x_movie)
        hold_out = int(all_len * self.hide_pct)
        perm = np.random.permutation(all_len)
        y_w = np.full(all_len, self.w_rest, dtype=np.float32)
        if hold_out > 0:
            y_w[-hold_out:] = self.w_hide

        return (x_movie[perm][:-hold_out] if hold_out > 0 else x_movie[perm],
                x_rating[perm][:-hold_out] if hold_out > 0 else x_rating[perm],
                np.ones(all_len - hold_out, dtype=np.float32),
                x_movie[perm],
                x_rating[perm],
                y_w,
                np.array([len(x_movie)], dtype=np.float32),
                np.concatenate((x_movie, valid_movie)))

    def __len__(self):
        return len(self.ds)


class ValidDataset(Dataset):
    def __init__(self, ds):
        self.ds = ds[~pd.isna(ds['rating_v'])]

    def __getitem__(self, index):
        x_movie = self.ds.iat[index, 0]  # movie_t
        x_rating = self.ds.iat[index, 1]  # rating_t
        y_movie = self.ds.iat[index, 2]  # movie_v
        y_rating = self.ds.iat[index, 3]  # rating_v

        y_w = np.full(len(y_movie), 1, dtype=np.float32)

        return (x_movie,
                x_rating,
                np.ones(len(x_movie), dtype=np.float32),
                y_movie,
                y_rating,
                y_w,
                np.array([len(y_movie)], dtype=np.float32),
                np.concatenate((x_movie, y_movie)))

    def __len__(self):
        return len(self.ds)


def to_tensors(arrs):
    return [torch.from_numpy(x) for x in arrs]


def pad_arrs(arrs, pad):
    return pad_sequence(to_tensors(arrs), batch_first=True, padding_value=pad)


def my_collate(batch, pad):
    transposed = [*zip(*batch)]
    return (pad_arrs(transposed[0], pad),
            pad_arrs(transposed[1], 0),
            pad_arrs(transposed[2], 0),
            pad_arrs(transposed[3], pad),
            pad_arrs(transposed[7], pad)), \
        (pad_arrs(transposed[4], 0),
         pad_arrs(transposed[5], 0),
         torch.stack(to_tensors(transposed[6]), 0))


def masked_softmax(x, mask):
    z = torch.exp(x)
    return z / ((z * mask).sum(-1)).unsqueeze(-1)


class RecModel(nn.Module):
    def __init__(self, nmovies, emb_size):
        super().__init__()

        self.memb = nn.Embedding(nmovies, emb_size, padding_idx=nmovies - 1)
        self.reset_parameters(self.memb.weight)

        self.memb2 = nn.Embedding(nmovies, emb_size, padding_idx=nmovies - 1)
        self.reset_parameters(self.memb2.weight)

    def reset_parameters(self, weight):
        init.kaiming_uniform_(weight, a=math.sqrt(5))

    def forward(self, x_m, x_r, x_w, y_m, i_m):
        x = self.memb(x_m)  # [batch, x_n_movies, emb_size]
        y = self.memb(y_m)  # [batch, y_n_movies, emb_size]
        y_i = self.memb(y_m)
        implicit = torch.tanh(self.memb2(i_m).sum(1))  # [batch, emb_size]
        y = y * implicit.unsqueeze(1)  # [batch, y_n_movies, emb_size]
        z = y.bmm(x.permute(0, 2, 1))  # [batch, y_n_movies, x_n_movies]
        # [batch, y_n_movies, x_n_movies]
        z = masked_softmax(z, x_w.unsqueeze(1))
        return (z * x_r.unsqueeze(1)).sum(-1)  # [batch, y_n_movies]


def my_loss(out, y_r, y_w, y_ct, batch_movies):
    return (nn.functional.mse_loss(out, y_r, reduction='none') * y_w).sum() / batch_movies


class CorrectRMSEMetric(Callback):
    def __init__(self, scale):
        self.name = 'RMSE'
        self.scale = scale

    def on_epoch_begin(self, **kwargs):
        self.sum, self.count = 0., 0

    def on_batch_end(self, last_output, last_target, **kwargs):
        self.count += last_target[2].sum()
        self.sum += (nn.functional.mse_loss(last_output,
                                            last_target[0],
                                            reduction='none') * last_target[1]).sum().detach().cpu()

    def on_epoch_end(self, last_metrics, **kwargs):
        return add_metrics(last_metrics, (self.sum/self.count) ** 0.5 * self.scale)


class DynamicBatchSampler(Sampler):
    def __init__(self, ds, hide_pct, batch_movies, mem_limit, valid=False):
        self.x_len = ds.ds['rating_t'].apply(lambda x: len(x))
        self.y_len = ds.ds['rating_v'].apply(
            lambda x: len(x) if isinstance(x, np.ndarray) else 0)

        if valid:
            self.sampler = SortSampler(
                self.x_len, key=lambda x: self.x_len.iloc[x])
        else:
            self.sampler = SortishSampler(self.x_len, key=lambda x: self.x_len.iloc[x],
                                          bs=len(self.x_len) // (sum(self.x_len) // batch_movies))

        self.hide_pct = hide_pct
        self.batch_movies = batch_movies
        self.mem_limit = mem_limit
        self.valid = valid
        self.estim_len = None

    def __iter__(self):
        batch = []
        batch_sum = 0
        batch_x_max = 0
        batch_y_max = 0
        for idx in self.sampler:
            prev_sum = batch_sum
            prev_x_max = batch_x_max
            prev_y_max = batch_y_max
            if self.valid:
                all_len = self.x_len.iat[idx] + self.y_len.iat[idx]
                x_len = self.x_len.iat[idx]
                y_len = self.y_len.iat[idx]
            else:
                all_len = self.x_len.iat[idx]
                x_len = all_len * (1 - self.hide_pct)
                y_len = all_len * self.hide_pct
            batch_sum += all_len
            batch_x_max = max(batch_x_max, x_len)
            batch_y_max = max(batch_y_max, y_len)
            estim_mem = batch_x_max * batch_y_max * (len(batch) + 1)
            if estim_mem > self.mem_limit:
                if len(batch) == 0:
                    batch_sum = 0
                    batch_x_max = 0
                    batch_y_max = 0
                    continue
                yield batch
                batch = [idx]
                batch_sum = all_len
                batch_x_max = x_len
                batch_y_max = y_len
            else:
                batch.append(idx)
            if batch_sum >= self.batch_movies:
                yield batch
                batch = []
                batch_sum = 0
                batch_x_max = 0
                batch_y_max = 0
        if len(batch) > 0:
            yield batch

    def __len__(self):
        if not self.estim_len:
            ct = 0
            for x in self:
                ct += 1
            self.estim_len = ct
        return self.estim_len


def train_rs(input_dir, model_name, lr, wd, epochs, emb_size, batch_movies, mem_limit, hide_pct, w_hide_ratio):
    print('Reading data...')
    ds = pd.read_csv(path.join(input_dir, 'ds.csv'))
    ds['rating'] = ds['rating'].astype('float32')
    with open(path.join(input_dir, 'm2i.pickle'), 'rb') as handle:
        m2i = pickle.load(handle)
    print('Test train split...')
    train, valid = train_test_split(ds)
    print('Unbiasing...')
    train, valid, bias = unbias(train, valid, len(m2i))
    with open(path.join(input_dir, 'bias.pickle'), 'wb') as handle:
        pickle.dump(bias, handle)
    print('Grouping dataset by user')
    groups_t, groups_v = train.groupby('user'), valid.groupby('user')
    movies_t, movies_v = groups_t['movie'].apply(
        np.array), groups_v['movie'].apply(np.array)
    ratings_t, ratings_v = groups_t['rating'].apply(
        np.array), groups_v['rating'].apply(np.array)
    ds = pd.concat([movies_t, ratings_t, movies_v, ratings_v], axis=1)
    ds.columns = ['movie_t', 'rating_t', 'movie_v', 'rating_v']
    ds = ds[~pd.isna(ds['rating_t'])]
    del movies_t, movies_v, ratings_t, ratings_v
    print('Training model...')
    train_d = TrainDataset(ds, hide_pct=hide_pct, w_hide_ratio=w_hide_ratio)
    valid_d = ValidDataset(ds)
    train_b_samp = DynamicBatchSampler(
        train_d, hide_pct, batch_movies, mem_limit)
    valid_b_samp = DynamicBatchSampler(
        valid_d, hide_pct, batch_movies, mem_limit, valid=True)
    train_l = DataLoader(train_d,
                         batch_sampler=train_b_samp,
                         num_workers=0,
                         collate_fn=lambda x: my_collate(x, len(m2i)),
                         pin_memory=True,
                         worker_init_fn=lambda x: np.random.seed(random.randint(0, 100) + x))
    valid_l = DataLoader(valid_d,
                         batch_sampler=valid_b_samp,
                         num_workers=0,
                         pin_memory=True,
                         collate_fn=lambda x: my_collate(x, len(m2i)))
    data = DataBunch(train_l, valid_l, path='fastai',
                     collate_fn=lambda x: my_collate(x, len(m2i)))
    model = RecModel(nmovies=len(m2i) + 1, emb_size=emb_size)

    learner = Learner(data, model, loss_func=lambda *xarg: my_loss(*xarg, batch_movies=batch_movies), wd=wd,
                      metrics=[CorrectRMSEMetric(1)])
    learner.fit_one_cycle(epochs, max_lr=lr, div_factor=10)

    learner.save(model_name)


def unbias(train, valid, nmovies):
    mean_movie = train.groupby('movie')['rating'].mean()
    bias = np.zeros(nmovies, dtype=np.float32)
    bias[mean_movie.index.values] = mean_movie
    bias = torch.tensor(bias)
    
    train = train.merge(mean_movie.to_frame(), on='movie',
                        suffixes=('', '_mean_movie'))
    train['rating'] = train['rating'] - train['rating_mean_movie']
    valid = valid.merge((mean_movie).to_frame(), on='movie',
                        suffixes=('', '_mean_movie'))
    valid['rating'] = valid['rating'] - valid['rating_mean_movie']
    return train, valid, bias


def train_test_split(ds):
    np.random.seed(100)
    split = ds.shape[0] * 9 // 10
    idx = np.random.permutation(np.arange(ds.shape[0]))
    train = ds.iloc[idx[:split]]
    valid = ds.iloc[idx[split:]]
    return train, valid


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Directory with processed Lastfm 350K dataset')
    parser.add_argument('--model_name', required=True,
                        help='Resulting model file name')
    parser.add_argument('--lr', type=float, required=True,
                        help='Learning rate')
    parser.add_argument('--wd', type=float, required=True,
                        help='Weight decay')
    parser.add_argument('--epochs', type=int, required=True,
                        help='Number of epochs')
    parser.add_argument('--emb_size', type=int, required=True,
                        help='Embedding size')
    parser.add_argument('--batch_movies', type=int, required=True,
                        help='Movies per batch')
    parser.add_argument('--mem_limit', type=float, required=True,
                        help='Limit on biggest matrix size during training')
    parser.add_argument('--hide_pct', type=float, required=True,
                        help='Percentage of artists to hide during training')
    parser.add_argument('--w_hide_ratio', type=float, required=True,
                        help='Ratio of loss weight of hidden to unhidden artists')

    args = parser.parse_args()
    train_rs(args.input_dir, args.model_name, args.lr,
             args.wd, args.epochs, args.emb_size, args.batch_movies, args.mem_limit, args.hide_pct, args.w_hide_ratio)
