const fs = require('fs');
const csv = require('csv-parser');
const elasticlunr = require('elasticlunr');

var index = null;
fs.createReadStream(process.argv[2] + '/web.csv')
    .pipe(csv())
    .on('data', (row) => {
        if (!index) {
            index = elasticlunr(function () {
                for (field in row) {
                    if (field.startsWith('t_')) {
                        this.addField(field);        
                    }
                }
                this.setRef('idx');
                this.saveDocument(false);
            });
        }
        index.addDoc(row);
    })
    .on('end', () => {
        fs.writeFileSync(process.argv[2] + '/web_index.json', JSON.stringify(index.toJSON()));
        console.log('Finished processing');
    });