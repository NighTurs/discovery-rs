const fs = require('fs');
const csv = require('csv-parser');
const elasticlunr = require('elasticlunr');

var index = elasticlunr(function () {
    this.addField('name');
    this.addField('tags');
    this.setRef('idx');
    this.saveDocument(false);
});

fs.createReadStream('../data/ds.csv')
    .pipe(csv())
    .on('data', (row) => {
        index.addDoc(row);
    })
    .on('end', () => {
        fs.writeFileSync('../data/ds_index.json', JSON.stringify(index.toJSON()));
        console.log('Finished processing');
    });