if git show-ref --verify --quiet "refs/heads/gh-pages"; then
    git push -d origin gh-pages
    git branch -D gh-pages
fi

git --work-tree web checkout --orphan gh-pages
git --work-tree web add --all
git --work-tree web rm -r --cached data
git --work-tree web add data/ml.zip
git --work-tree web add data/lf.zip
git --work-tree web add data/gb.zip
git --work-tree web add data/msd.zip
git --work-tree web commit -m "Github pages deploy"
git push origin gh-pages
git checkout master --force