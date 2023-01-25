import fs from 'fs'
import { uniq } from 'underscore'
import { scraper } from './scraper';


const getFilename = (url: string) => 
    url.replace(/http[s]?:\/\//, '').replace('/', '_');

const domain = process.argv.splice(-1)[0];
const recursive = process.argv.indexOf('-r') > 0;
const checkStatus = process.argv.indexOf('-s') > 0;
const filename = getFilename(domain);

scraper({ domain, checkStatus, recursive }).then(result => {
    const content = uniq(result, link => link.href)
        .map((link) => Object.values(link).join(';'))
        .join('\n');
    fs.writeFile(`${filename}.csv`, `path;page;link;href;external;status\n${content}`, (err) => console.error(err));
});
