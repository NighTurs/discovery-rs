import argparse
import pickle
import random
import pandas as pd
import numpy as np
from os import path
import torch
import torch.nn as nn
from torch.utils.data import Dataset
from torch.utils.data import DataLoader
from fastai.basic_data import *
from fastai.basic_train import *
from fastai.train import *


class TrainDataset(Dataset):
    def __init__(self, ds, nartists, hide_pct=0.5, w_hide_ratio=1, w_neg=0.5):
        self.w_neg = w_neg
        self.ds = ds
        self.nartists = nartists
        self.w_hide_ratio = w_hide_ratio
        self.hide_pct = hide_pct

    def __getitem__(self, index):
        x_artist = self.ds.iat[index]

        dp = np.random.rand(len(x_artist)) > self.hide_pct

        y = np.zeros(self.nartists, dtype=np.float32)
        y[x_artist] = 1

        x = np.zeros(self.nartists, dtype=np.float32)
        x[x_artist[dp]] = 1

        dp_ct = len(x_artist) - dp.sum()
        w_rest = len(x_artist) / ((len(x_artist) - dp_ct) +
                                  dp_ct * self.w_hide_ratio)
        w_hide = w_rest * self.w_hide_ratio

        l = len(x_artist)
        w = np.full(self.nartists, self.w_neg * self.nartists /
                    (self.nartists - l), dtype=np.float32)
        w[x_artist] = w_hide * (1 - self.w_neg) * self.nartists / l
        w[x_artist[dp]] = w_rest * (1 - self.w_neg) * self.nartists / l

        return (x), \
               (y,
                w,
                np.array([self.nartists], dtype=np.float32))

    def __len__(self):
        return len(self.ds)


class ValidDataset(Dataset):
    def __init__(self, ds, nartists, hold_out=5, w_neg=0.5):
        np.random.seed(100)
        self.ds = [a[np.random.permutation(np.arange(len(a)))]
                   for a in ds.values]
        self.nartists = nartists
        self.hold_out = hold_out
        self.w_neg = w_neg

    def __getitem__(self, index):
        x_artist = self.ds[index]
        hold_out = self.hold_out

        y = np.zeros(self.nartists, dtype=np.float32)
        y[x_artist[-hold_out:]] = 1

        x = np.zeros(self.nartists, dtype=np.float32)
        x[x_artist[:-hold_out]] = 1

        left = self.nartists - len(x_artist) + hold_out
        w = np.full(self.nartists, self.w_neg * left /
                    (left - hold_out), dtype=np.float32)
        w[x_artist] = 0
        w[x_artist[-hold_out:]] = (1 - self.w_neg) * left / hold_out

        return (x), (y, w, np.array([left], dtype=np.float32))

    def __len__(self):
        return len(self.ds)


class RecModel(nn.Module):
    def __init__(self, nartist, emb_size, fixed_abias):
        super().__init__()
        self.fc1 = nn.Linear(nartist, emb_size)
        self.fc2 = nn.Linear(emb_size, nartist)
        self.abias = nn.Parameter(
            torch.tensor(fixed_abias, dtype=torch.float32))
        self.abias.requires_grad = False

    def forward(self, x):
        v = torch.tanh(self.fc1(x))
        v = torch.sigmoid(self.fc2(v) + self.abias)
        return v


def my_loss(out, y, w, ct):
    return (nn.functional.mse_loss(out, y, reduction='none') * w).sum() / ct.sum()


def train_rs(input_dir, model_name, w_neg, lr, wd, epochs, emb_size, batch_size, hide_pct, w_hide_ratio):
    print('Reading data...')
    ds = pd.read_csv(path.join(input_dir, 'ds.csv'))
    with open(path.join(input_dir, 'u2i.pickle'), 'rb') as handle:
        u2i = pickle.load(handle)
    with open(path.join(input_dir, 'a2i.pickle'), 'rb') as handle:
        a2i = pickle.load(handle)
    print('Calculating abias...')
    abias = calc_abias(ds, w_neg)
    print('Test train split...')
    ds = ds.groupby('user')['artist'].apply(np.array)
    train, valid = train_test_split(ds)

    print('Training model...')
    random.seed(100)
    train_d = TrainDataset(train, nartists=len(
        a2i), hide_pct=hide_pct, w_hide_ratio=w_hide_ratio)
    valid_d = ValidDataset(valid, nartists=len(a2i))

    train_l = DataLoader(train_d, batch_size=batch_size, shuffle=True, num_workers=4,
                         pin_memory=True,
                         worker_init_fn=lambda x: np.random.seed(random.randint(0, 100) + x))
    valid_l = DataLoader(valid_d, batch_size=batch_size,
                         pin_memory=True, shuffle=False)

    data = DataBunch(train_l, valid_l, path='fastai')
    model = RecModel(nartist=len(a2i), emb_size=emb_size,
                     fixed_abias=abias)

    learner = Learner(data, model, loss_func=my_loss, wd=wd, true_wd=False)

    learner.fit_one_cycle(epochs, max_lr=lr, div_factor=10)
    learner.save(model_name)


def train_test_split(ds):
    np.random.seed(100)
    split = ds.shape[0] * 95 // 100
    idx = np.random.permutation(np.arange(ds.shape[0]))
    train = ds.iloc[idx[:split]]
    valid = ds.iloc[idx[split:]]
    print(train.shape[0], valid.shape[0])
    return train, valid


def calc_abias(ds, w_neg):
    l = ds.shape[0]
    freq = ds.groupby('artist')['playcount'].count()
    bias = (freq / l * (1 - w_neg)) / \
        (freq / l * (1 - w_neg) + 1 / len(freq) * w_neg)
    bias = np.log(bias / (1 - bias))
    return bias


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', required=True,
                        help='Directory with processed Lastfm 350K dataset')
    parser.add_argument('--model_name', required=True,
                        help='Resulting model file name')
    parser.add_argument('--w_neg', type=float, required=False, default=0.5,
                        help='Weight of negative samples')
    parser.add_argument('--lr', type=float, required=True,
                        help='Learning rate')
    parser.add_argument('--wd', type=float, required=True,
                        help='Weight decay')
    parser.add_argument('--epochs', type=int, required=True,
                        help='Number of epochs')
    parser.add_argument('--emb_size', type=int, required=True,
                        help='Embedding size')
    parser.add_argument('--batch_size', type=int, required=True,
                        help='Batch size')
    parser.add_argument('--hide_pct', type=float, required=True,
                        help='Percentage of artists to hide during training')
    parser.add_argument('--w_hide_ratio', type=float, required=True,
                        help='Ratio of loss weight of hidden to unhidden artists')

    args = parser.parse_args()
    train_rs(args.input_dir, args.model_name, args.w_neg, args.lr,
             args.wd, args.epochs, args.emb_size, args.batch_size, args.hide_pct, args.w_hide_ratio)
