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
