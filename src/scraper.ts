import axios, { AxiosResponse } from 'axios';
import { load } from 'cheerio';
import { promisify } from 'util'
import { logger } from './logger';

const sleep = promisify(setTimeout);

export const scraper = (config: Config) => new Scraper(config).scrapePages([''], '/');

class Scraper {
    private visited: string[] = [];
    private checked: Record<string, any> = {};
    private protocol = new RegExp(/http[s]?:\/\//);
    private domainExpr: RegExp;

    constructor(private config: Config) {
        this.domainExpr = new RegExp(`${this.protocol}${config.domain.replace(this.protocol, '')}`);
    }

    public async scrapePages(urls: string[], referer: string): Promise<Item[]> {
        const requests = urls.map(async url => {
            const response = await this.loadPage(url);
            return response.data ? this.parsePage(response.data, url, referer) : [];
        });
        return Promise.all(requests).then((result) => result.flat());
    }

    private async loadPage(url: string): Promise<AxiosResponse> {
        if(url === undefined || this.wasVisited(url)) {
            return {} as AxiosResponse;
        }

        logger.info(`processing ${url}`);
        this.visited.push(url);

        return await axios.get(`${this.config.domain}/${url}`)
            .catch((reason) => {
                logger.error(`failed to get ${url}: ${reason}`);
                return { statusText: reason } as AxiosResponse;
            });
    }

    private async parsePage(data: string, url: string, referer: string): Promise<Item[]> {
        const $html = load(data);
        const title = $html('title').text();
        const links: Item[] = await Promise.all($html('a').map(async (_, element) => {
            const $a = $html(element);
            const href = $a.attr('href');
            const url = href?.replace(/\.\.\//g, '')
                ?.replace(this.config.domain, '')
                ?.trim();
            const external = url !== undefined && (url.startsWith('http://') 
                || url.startsWith('https://')
                || url.startsWith('www.'));
            const item: Item = {
                path: referer,
                page: title,
                text: $a.text().trim().replace(/(\n|\t)+/, ' '),
                href: url ?? '',
                external,
            };
            if (this.config.checkStatus && url && external) {
                if (href != url) {
                    logger.debug(`${href} to ${url}`);
                }
                item.status = await this.checkStatus(url);
            }
            return item;
        }).get());

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
        logger.debug(`    ${subpages.length} pages on '${referer}/${url}'`);

        return links.concat(subpages);
    }

    private async checkStatus(url: string) {
        const preflight = {
            Origin: this.config.domain,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'X-Custom-Header'
        };
        if (url in this.checked) {
            return this.checked[url];
        }

        logger.debug(`   check ${url} ...`)
        try {
            const response = await fetch(url.replace('www.', 'http://www.'), {
                // headers: preflight
            });
            this.checked[url] = response;
            return response.statusText;
        } catch ({ cause }) {
            const reason = JSON.stringify(cause);
            logger.error(`failed to get ${url}: ${reason}`);
            return reason;
        }
    }

    private skipPage = (link: Item) => link.href && (link.external 
        || link.href.startsWith('#')
        || link.href.startsWith('../'));

    private wasVisited = (url: string) => this.visited.some((u) => u == url);
}
