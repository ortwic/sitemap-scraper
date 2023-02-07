import axios, { AxiosResponse } from 'axios';
import { inspect } from 'util';
import { load } from 'cheerio';
import { promisify } from 'util'
import { logger } from './logger';
import { isExternal, skipPage, withProtocol } from './utils/helper';

const sleep = promisify(setTimeout);

export const scraper = (config: Config) => new Scraper(config).scrapePages([''], '/');

class Scraper {
    private visited: string[] = [];
    private checked: Record<string, any> = {};
    private domain: URL = new URL(this.config.domain);

    constructor(private config: Config) {
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

        return await axios.get(this.pathToUrl(url))
            .catch((reason) => {
                logger.error(`failed to get ${url}: ${reason}`);
                return { statusText: reason } as AxiosResponse;
            });
    }

    private pathToUrl = (url: string): string => {
        return withProtocol(url) ? url : `${this.domain.href}/${url}`;
    }

    private async parsePage(data: string, url: string, referer: string): Promise<Item[]> {
        const $html = load(data);
        const title = $html('title').text();
        const links: Item[] = await Promise.all($html('a').map(async (_, element) => {
            const $a = $html(element);
            const href = $a.attr('href');
            const url = href?.replace(/\.\.\//g, '')?.trim();
            const item: Item = {
                path: referer,
                page: title,
                text: $a.text().trim().replace(/(\n|\t)+/, ' '),
                href: url ?? '',
                external: isExternal(this.domain, url),
            };
            if (this.config.checkStatus && url && item.external) {
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

        if (this.config.recursive) {
            const paths = links.filter((link) => !skipPage(link))
                .map((link) => link.href);

            const subpages = await this.scrapePages(paths, url);
            logger.debug(`    ${subpages.length} pages on '${referer}/${url}'`);

            return links.concat(subpages);
        }

        return links;
    }

    private async checkStatus(url: string) {
        const preflight = {
            Origin: this.domain.href,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'X-Custom-Header'
        };
        if (url in this.checked) {
            return this.checked[url];
        }

        try {
            const target = new URL(url.replace(/^www\./, 'http://www.'));
            logger.debug(`   check ${target}`)
            const response = await fetch(target, {
                // headers: preflight
            });
            this.checked[url] = response;
            return response.statusText;
        } catch ({ cause }) {
            logger.error(`failed to get ${url}: ${inspect(cause)}`);
            if (cause instanceof Response) {
                return cause.statusText;
            } else {
                try {
                    return JSON.stringify(cause);
                } catch {
                    return Object.values(cause as any).join(', ');
                }
            }
        }
    }

    private wasVisited = (url: string) => this.visited.some((u) => u == url);
}
