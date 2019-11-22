const fs = require('fs');
const csv = require('csv-parser');
const MiniSearch = require('minisearch');

let index = null;
const rows = [];

fs.createReadStream(`${process.argv[2]}/web.csv`)
  .pipe(csv())
  .on('data', (row) => {
    if (!index) {
      const fields = [];
      Object.keys(row).forEach((field) => {
        if (field.startsWith('t_')) {
          fields.push(field);
        }
      });
      fields.push('t_flags');
      index = new MiniSearch({ fields, idField: 'idx' });
    }
    // eslint-disable-next-line no-param-reassign
    row.idx = +row.idx;
    rows.push(row);
  })
  .on('end', () => {
    index.addAll(rows);
    fs.writeFileSync(`${process.argv[2]}/web_index.json`, JSON.stringify(index.toJSON()));
  });
