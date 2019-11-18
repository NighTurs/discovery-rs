const fs = require('fs');
const csv = require('csv-parser');
const MiniSearch = require('minisearch');

let index = null
let rows = [];

fs.createReadStream(process.argv[2] + '/web.csv')
    .pipe(csv())
    .on('data', (row) => {
        if (!index) {
            let fields = [];
            for (field in row) {
                if (field.startsWith('t_')) {
                    fields.push(field);
                }
            }
            index = new MiniSearch({fields: fields, idField: 'idx'})
        }
        rows.push(row);
    })
    .on('end', () => {
        index.addAll(rows);
        fs.writeFileSync(process.argv[2] + '/web_index.json', JSON.stringify(index.toJSON()));
    });


