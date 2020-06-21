#!/usr/bin/env bash

error_handling() {
    git push -d origin gh-pages 2> /dev/null
    git branch -D gh-pages 2> /dev/null
    exit 1
}

trap 'error_handling' ERR

if git show-ref --verify --quiet "refs/heads/gh-pages"; then
    git push -d origin gh-pages
    git branch -D gh-pages
fi

git --work-tree web checkout --orphan gh-pages
git --work-tree web add --all
git --work-tree web rm -r --cached data
git --work-tree web add -f data/ml.zip
git --work-tree web add -f data/lf.zip
git --work-tree web add -f data/gb.zip
git --work-tree web add -f data/msd.zip
git --work-tree web commit -m "Github pages deploy"
git push origin gh-pages
git checkout master --force

aws s3 sync \
    --profile nighturs \
    --acl public-read \
    --exclude "*" \
    --include "*.model" \
    ./models s3://nighturs/discovery-rs/models