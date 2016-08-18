const SinaLogin = require('./sinalogin');
const Crawler = require('./crawler');
const cheerio = require('cheerio');
const fs = require('fs');
const url = require('url');
const request = require('request');
const async = require('async');

let account = {
    username: '',
    password: '',
    cookiefile: 'cookie.bat'
};

let sina = new SinaLogin(account, function(err) {
    if (err) {
        fs.unlink(account.cookiefile, (err) => {
            if (err) {
                return console.log(err.message);
            }
            sina.login();
        });
        return console.log('The error message:' + err.message);
    }
    let cookies = sina.cookieLoad();
    let keyword = '疫苗事件';
    let options = {
        url: 'http://s.weibo.com/weibo/' + encodeURIComponent(encodeURIComponent(keyword)) + '&page=1',
        headers: {
            Cookie: cookies,
            
        }
    };

    class Weibo {
        constructor(mid, wbContent, date) {
            this.mid = mid;
            this.wbContent = wbContent;
            this.date = date;
        }
    }

    let crawlerCallback = function(err, res, body) {
        if (err) throw err;
        let fetchUrl = (function(cookies) {
            let urls = null;
            let pattern = /<script>STK\s*&&\s*STK\.pageletM\s*&&\s*STK\.pageletM\.view\(\{"pid":"pl_weibo_direct".*\)<\/script>/;
            let getPagers = function($) {
                let anchors = $('*').find('div.W_pages').find('a[suda-data=\'key=tblog_search_weibo&value=weibo_page_1\']');
                let links = anchors.map(function(index, elem) {
                    let href = $(this).attr('href');
                    return url.resolve('http://s.weibo.com/', href);
                });
                links.splice(links.length - 1, 1);
                return links;
            };
            let baseRequest = request.defaults({
                headers: { Cookie: cookies, Domain: 'sina.com.cn'},
                timeout: 1500
            });
            return function(url, callback) {
                baseRequest(url, (err, response, body) => {
                    if (err) { return callback(err); }
                    let result = body.match(pattern) || [];
                    let weiboContent = result[0] || '';
                    let wbBlock = weiboContent.slice(weiboContent.indexOf('{'), weiboContent.lastIndexOf(')'));
                    if (wbBlock) {
                        let content = JSON.parse(wbBlock).html;
                        // console.log(content);
                        $ = cheerio.load(content);
                        let nodes = $('*').find('div.WB_cardwrap.S_bg2.clearfix');
                        let contents = nodes.map(function(index, elem) {
                            let wbContent = $(this).find('p.comment_txt').text();
                            if (typeof wbContent === 'undefined') return;
                            let mid = $(this).find('div[action-type=feed_list_item]').attr('mid');
                            mid = typeof mid !== 'undefined' ? mid : Date.now();
                            let date = $(this).find('a.W_textb').attr('date');
                            date = typeof date !== 'undefined' ? new Date(parseInt(date)).toLocaleString() : new Date().toLocaleString();
                            return new Weibo(mid, wbContent, date);
                        });
                        if (urls === null) {
                            urls = getPagers($);
                            return callback(err, urls);
                        } else {
                            callback(null, contents);
                        }
                    } else {
                        callback(new Error('content is null.'));
                    }
                });
            };
        })(cookies);

        /**
         * async.mapLimit();
         */
        function limitAccess(urls, callback) {
            async.mapLimit(urls, 5, (url, callback) => {
                fetchUrl(url, callback);
            }, (err, results) => {
                callback(err, results);
            });
        }

        async.waterfall([
            function(callback) {
                let url = 'http://s.weibo.com/weibo/' + encodeURIComponent(encodeURIComponent(keyword)) + '&page=1';
                fetchUrl(url, callback);
            },
            limitAccess
        ], function(err, results) {
            if (err) { console.log(err.message); }
            if (!results) {
                return console.log('results is null.'); }
            console.log(results);
            fs.writeFile('./example.txt', results, 'utf8', function(err) {
                if (err) {
                    return console.log(err.message); }
                console.log('Success saved!');
            });
        });
    };
    let crawler = new Crawler(options, crawlerCallback);
    crawler.run();
});
sina.login();
