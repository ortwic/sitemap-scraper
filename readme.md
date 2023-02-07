# scraper to generate sitemaps

Scraper for static HTML sites which exports its link into csv file. Simular to [Sitemap Generator](https://www.mysitemapgenerator.com/) but very simple.

Usage: 

```
npm run start -- [-s|-r] https://example.com
  -s  check http status of external urls with fetch api (experimental)`
  -r  traverse recursivly all subpages of domain
```