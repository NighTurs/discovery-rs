import pandas as pd


def keep_positive_ratings(ds, user_col, item_col, rating_col='rating', pct_cutoff=0.1):
    ulen = {row[1]: row[2] for row in ds.groupby(
        user_col)[item_col].count().reset_index().itertuples()}
    res = ds[ds[rating_col] == 5.0]
    ulenct = {row[1]: row[2] for row in res.groupby(
        user_col)[item_col].count().reset_index().itertuples()}
    for rating in reversed(range(8, 10)):
        r = rating / 2
        chunks = []
        for user, group in ds[ds[rating_col] == r].groupby(user_col):
            if ulenct.get(user, 0) < ulen[user] * pct_cutoff:
                chunks.append(group)
                ulenct[user] = ulenct.get(user, 0) + group.shape[0]
        res = pd.concat(chunks + [res])
        del chunks
    return res


def count_filter(ds, threshold, col, col_ct):
    ct = ds.groupby(col)[col_ct].count()
    keep = ct[ct >= threshold].index.values
    return ds[ds[col].isin(keep)]


def percentile(series):
    d = {k: v / len(series)
         for v, k in enumerate(series.sort_values().index.values)}
    return [d[i] for i in series.index.values]


def rescale_tsne(df, axis_max=100):
    x_min, x_max = df['x'].min(), df['x'].max()
    y_min, y_max = df['y'].min(), df['y'].max()
    df['x'] = -axis_max + (df['x'] - x_min) / (x_max - x_min) * 2 * axis_max
    df['y'] = -axis_max + (df['y'] - y_min) / (y_max - y_min) * 2 * axis_max
    return df
