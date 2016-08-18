const request = require('request');
const cheerio = require('cheerio');

function Crawler(options,callback) {
    this.options = options;
    this.callback = callback;
}

Crawler.prototype.run = function () {
    request(this.options,this.callback);
}

// function (options,callback) {
//     if (!options.url) {
//         return callback(new Error('No valid url.'));
//     }
//     if (!options.headers.cookies) {
//
//     }
//     request(options,callback);
// }

function callback(err,res,body) {
    console.log(body);
}

module.exports = Crawler;
