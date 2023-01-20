import axios from 'axios';
import { load } from 'cheerio';
import { promisify } from 'util'
import { logger } from './logger';

interface Item {
    path: string;
    page: string;
    text: string;
    href: string;
    external: boolean;
}

const sleep = promisify(setTimeout);

export const scraper = (domain: string) => new Scraper(domain).scrapePages([''], '/');

class Scraper {
    private visited: string[] = []; 

    constructor(public domain: string) {

    }

    public async scrapePages(urls: string[], referer: string): Promise<Item[]> {
        const requests = urls.map(async url => {
            const $ = await this.loadPage(url);
            return $ ? this.parsePage($, url, referer) : [];
        });
        return Promise.all(requests).then((result) => result.flat());
    }

    private async loadPage(url: string): Promise<cheerio.Root | undefined> {
        if(url === undefined || this.wasVisited(url)) {
            return;
        }

        logger(`processing ${url}`);
        this.visited.push(url);

        const response = await axios.get(`${this.domain}/${url}`)
            .catch((reason) => logger(`failed to get ${url}: ${reason}`));
            
        if(typeof response !== 'boolean' && response.status == 200) {
            return load(response.data);
        }

        return;
    }

    private async parsePage($html: cheerio.Root, url: string, referer: string): Promise<Item[]> {
        const title = $html('title').text();
        const links: Item[] = $html('a').map((_, element) => {
            const $a = $html(element);
            const href = $a.attr('href')
                ?.replace(/\.\.\//g, '')
                ?.replace(this.domain, '')
                ?.trim();
            return {
                path: referer,
                page: title,
                text: $a.text().trim().replace(/(\n|\t)+/, ' '),
                href,
                external: href?.startsWith('http://') 
                    || href?.startsWith('https://')
                    || href?.startsWith('www.')
            }
        }).get();

        links.concat($html('form').map((_, element) => {
            const $form = $html(element);
            return {
                path: referer,
                page: title,
                text: `form ${$form.text()}`,
                href: $form.attr('action')
            }
        }).get());

        const paths = links.filter((link) => !this.skipPage(link))
            .map((link) => link.href);

        const subpages = await this.scrapePages(paths, url);
        logger(`    ${subpages.length} on ${referer}/${url}`);

        return links.concat(subpages);
    }

    private skipPage = (link: Item) => link.href && (link.external 
        || link.href.startsWith('#')
        || link.href.startsWith('../'));

    private wasVisited = (url: string) => 
        this.visited.some((u) => u == url);
}
