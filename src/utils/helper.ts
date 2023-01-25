export const withProtocol = (url: string) => 
    url.startsWith('http://') || url.startsWith('https://');
    
export const isExternal = (domain: URL, url?: string) => url !== undefined 
    && (withProtocol(url)
    && domain.host != new URL(url.replace('://www.', '://')).host
    || url.startsWith('www.'));

export const skipPage = (link: Item) => link.href && (link.external 
    || link.href.startsWith('#')
    || link.href.startsWith('../'));
