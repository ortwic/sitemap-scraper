import fs from 'fs'
import { uniq } from 'underscore'
import { scraper } from './scraper';

scraper(process.argv.splice(-1)[0]).then(result => {
    const content = uniq(result, link => link.href)
        .map((link) => `${link.path};${link.page};${link.text};${link.href};${link.external}`)
        .join('\n');
    fs.writeFile('result.csv', `path;page;link;href;external\n${content}`, (err) => console.error(err));
});
