const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');

const fetchMovieTitles = async (year, pageNum) => {
    var res = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=cb263f7b9500919d4895b47672d29010&sort_by=popularity.desc&primary_release_year=${year}&page=${pageNum}`);
    var json = await res.json();
    return json['results'].map(result => result['title']);
};

const crawlPage = () => {
    var info = {};

    try {
        info['title'] = document.querySelector('.PZPZlf.gsmt').textContent;

        var ratingEl = document.querySelector('.wwUB2c.PZPZlf .zqhAOd');
        info['rating'] = ratingEl ? ratingEl.textContent : '?';

        var infoRowText = document.querySelector('.wwUB2c.PZPZlf').textContent.substring(ratingEl ? info['rating'].length : 0).trim();
        var infoRowMatches = infoRowText.match(/^(.*)\s‧\s(.*)\s‧\s(.*)$/);

        info['year'] = parseInt(infoRowMatches[1]);
        info['genre'] = infoRowMatches[2];

        var durationStr = infoRowMatches[3];
        var durationStrMatches = durationStr.match(/^(\d*)h\s(\d*)m$/);

        var hours = parseInt(durationStrMatches[1]);
        var minutes = parseInt(durationStrMatches[2]);
        info['duration'] = hours * 60 + minutes;

        info['reviews'] = {};
        info['reviews']['google'] = parseFloat(document.querySelector('.srBp4.Vrkhme').textContent.match(/^(.*)%/)[1]) / 100.0;
        info['reviews']['imdb'] = parseFloat(document.querySelectorAll('.gsrt.IZACzd')[0].textContent.match(/^(.*)\//)[1]) / 10.0;
        info['reviews']['tomatoes'] = parseFloat(document.querySelectorAll('.gsrt.IZACzd')[1].textContent.match(/^(.*)%/)[1]) / 100.0;
    } catch (e) {
        return null;
    }
    
    return info;
};

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const movieData = [];
    let year = 2000;
    let pageNum = 1;

    while (pageNum < 100) {
        const movieTitles = await fetchMovieTitles(year, pageNum);

        for (let i = 0; i < movieTitles.length; i++) {
            await page.goto(`https://www.google.com/search?q=${movieTitles[i]} (${year})`);
        
            const data = await page.evaluate(crawlPage);

            if (data !== null && data['year'] === year) {
                console.log(data);
                movieData.push(data);
            }
        }

        // save data to file
        fs.writeFileSync('movie-data.json', JSON.stringify(movieData, null, 4));

        console.log(`Finished crawling movies for year: ${year} and page: ${pageNum}`);
        console.log(`Total movies crawled: ${movieData.length}`);

        // wait a bit, so google does not start ignoring the repeated requets
        await new Promise((resolve) => {
            setTimeout(() => resolve(), 30000);
        });

        // crawl next year, or if out of years, start over and go to next page
        year++;
        if (year >= 2020) {
            year = 2000;
            pageNum++;
        }
    }

    browser.close();
})();
