const request = require('request');
const async = require('async');
const sinaSSOEncoder = require('./sinaSSOEncoder');
const fs = require('fs');
const readline = require('readline');
const querystring = require('querystring');
const SinaRSA = require('../SinaRSA');
const FileCookieStore = require('tough-cookie-filestore');

var encrypt = {};//从新浪服务端取得对密码进行加密的公玥数据
var loginStatus = 0;//0表示未登录状态
var pincode = 'pincode.png';//这里先暂时固定位置，等后面再跳整
var loginInfo = {};

var accountInfo = null;
var callbackFn = null;

//这个构造函数还需要改进，加入对输入参数的判断？？
//这里可以加一个options参数，包括（验证码图片的存放地址）
var SinaLogin = function (account,callback) {
    this.account = account;
    // this.callback = callback;
    accountInfo = account;
    callbackFn = callback;
}

SinaLogin.prototype.login = function () {
    if (this.account.cookiefile && fs.existsSync(this.account.cookiefile)) {
        let cookies = this.cookieLoad(this.account.cookiefile);
        testCookie(cookies)
    } else {
        main();
    }
}

SinaLogin.prototype.cookieLoad = function () {
    let data = fs.readFileSync(this.account.cookiefile,'utf-8');
    return data;
}

function main() {
    async.waterfall([
        getMicroBlogRsa,
        parseEncryptContent,
        solveVertifyCode,
        login,
        loginJump
    ],callbackFn);
}

/**
sinaSSOController.preloginCallBack({
    "retcode":0,
    "servertime":1468308635,
    "pcid":"gz-98be17ebda86188f7d3e69642ff57e37a96d",
    "nonce":"GDRVH8",
    "pubkey":"EB2A38568661887FA180BDDB5CABD5F21C7BFD59C090CB2D245A87AC253062882729293E5506350508E7F9AA3BB77F4333231490F915F6D63C55FE2F08A49B353F444AD3993CACC02DB784ABBB8E42A9B1BBFFFB38BE18D78E87A0E41B9B8F73A928EE0CCEE1F6739884B9777E4FE9E88A1BBE495927AC4A799B3181D6442443",
    "rsakv":"1330428213","is_openlock":0,"lm":1,
    "smsurl":"https:\/\/login.sina.com.cn\/sso\/msglogin?entry=weibo&mobile=18765937002&s=210b253f651dfa2b34aa1574f31ad7a6",
    "showpin":0,"exectime":327})
*/
function getMicroBlogRsa(callback) {
    // letg username = accountInfo.username.replace(/@/g, '%40');
    let encodeUsername = sinaSSOEncoder.base64.encode(encodeURIComponent(accountInfo.username));
    let loginURL = 'http://login.sina.com.cn/sso/prelogin.php?entry=weibo&callback=sinaSSOController.preloginCallBack&su=' +
        encodeUsername +
        '&rsakt=mod&checkpin=1&client=ssologin.js(v1.4.11)&_=' +
        Date.now();
    request(loginURL,(error, respones, body) => {
        if (!error && respones.statusCode == 200) {
            // console.log(body);
            encrypt.content = body;
        }
        callback(error);
    });
}
/**
 * 将preloginCallBack中返回的字符串数据解析成对象
 * @param  {Function} callback [Nodejs模式的回调，有错误时处理错误，无错误时传入null]
 * @return {[type]}            [无]
 */
function parseEncryptContent(callback) {
    let reg = /\{.*\}/;
    try {
        let str = reg.exec(encrypt.content);
        let obj = JSON.parse(str);
        encrypt.content = obj;
    } catch (e) {
        return callback(e);
    }
    callback(null);
}
/**
 * 当需要填验证码时，需要去该地址去获取验证码图片
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function getPinImage(callback) {
    let url = 'http://login.sina.com.cn/cgi/pin.php' +
        '?r=' + Math.floor(Math.random() * 1e8) +
        '&s=' + 0 + '&p=' + encrypt.content.pcid;
    try {
        request(url).pipe(fs.createWriteStream(pincode));
    } catch (e) {
        return callback(e);
    }
    callback(null);
}
/**
 * 使用readline进行交互，用户在控制台中输入验证码，后面可以改成直接在浏览器上交互
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function inputPinCode(callback) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('请输入验证码： \n', function (input) {
        console.log('你输入的验证码为：' + input);
        rl.close();
        return callback(null,input);
    });
}
/**
 * 如果当前未登录，且返回信息中showpin为1，则表明需要输入验证码
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function solveVertifyCode(callback) {
    console.log(encrypt.content.showpin);
    if (loginStatus || encrypt.content.showpin == 1) {
        async.waterfall([
            getPinImage,
            inputPinCode
        ],callback);
    } else {
        console.log('一切顺利，无需验证码！！！');
        callback(null,null);
    }
}

function encodePassword(keyt,passwd) {
    let pwd = keyt.servertime + '\t' + keyt.nonce + '\n' + passwd;
    let RSAKey = new SinaRSA.RSAKey();
    RSAKey.setPublic(keyt.pubkey, '10001');
    return RSAKey.encrypt(pwd);
}
/**
 * 准备就绪后，发起登录请求，组装登录信息，包括用户名、密码或验证码等，成功后方能跳转
 * 去获取cookie信息
 * @param  {[type]}   code     [输入的验证码]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function login(code,callback) {
    let encodedPwd = encodePassword(encrypt.content,accountInfo.password);
    let postUrl = 'http://login.sina.com.cn/sso/login.php?client=ssologin.js(v1.4.11)';
    let params = {
            entry: 'weibo',
            gateway: '1',
            savestate: '7',
            from: '',
            useticket: '1',
            pagerefer: 'http://weibo.com/a/download',
            vsnf: '1',
            su: sinaSSOEncoder.base64.encode(accountInfo.username),
            service: 'miniblog',
            servertime: encrypt.content.servertime,
            nonce: encrypt.content.nonce,
            pwencode: 'rsa2',
            rsakv: encrypt.content.rsakv,
            sp: encodedPwd,
            encoding: 'UTF-8',
            url: 'http://weibo.com/ajaxlogin.php?framelogin=1&callback=parent.sinaSSOController.feedBackUrlCallBack',
            eturntype: 'META',
            ssosimplelogin: '1'
        };

        if (loginStatus || encrypt.content.showpin == 1) {
            params.door = code;
            params.pcid = encrypt.content.pcid;
        }

        request.post({url:postUrl,form:params},(err,respones,body) => {
            loginInfo.content = body;
            // console.log(body);
            callback(err);
        });
}
/**
 * 当登录后根据结果跳转到指定接口获取cookie信息
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function loginJump (callback) {
    //注意其中的捕获组，那就是我们要的上面登录返回的结果
    let reg = /location.replace\(["'](.*)["']\)/;
    let jumpUrl = reg.exec(loginInfo.content)[1];
    let obj = querystring.parse(jumpUrl);
    if (obj.retcode == 0) {
        let jar = request.jar(new FileCookieStore('cookies.json'));
        request.defaults({jar:jar}).get(jumpUrl,function () {
            // var cookies = jar.getCookies(jumpUrl);
            cookieSave(accountInfo.cookiefile);
            callback(null);
        });
    } else if (obj.retcode == 4049) { //需要填入验证码
        loginStatus = 1;//难道不用输入验证码了吗
        // console.log("错误原因：" + obj.reason);
        return main();
    }
    callbackFn(obj);
}

function cookieSave(cookiefile) {
    if (fs.existsSync('./cookies.json')) {
        fs.readFile('./cookies.json',(err,data) => {
            if (err) throw err;
            let cookieArray = [];
            let cookies = JSON.parse(data);
            cookies = cookies['weibo.com']['/'];
            for (let prop in cookies) {
                let cookie = cookies[prop];
                cookieArray.push([cookie.key,cookie.value].join('='));
            }
            fs.writeFileSync(cookiefile,cookieArray.join(';'));
        });
    }
}

function testCookie(cookies) {
    let options = {
        url:'http://weibo.com/messages',
        headers:{
            cookies:cookies
        }
    };
    let callback = function (err,response,body) {
        if (err) {
            return callbackFn(err);
        }
        if (response.statusCode == 302) {
            console.log('Cookie Invalid!');
            return callbackFn(err);
        } else {
            console.log('Cookie Wonderful!')
            accountInfo.logined = true;
            callbackFn(null,accountInfo);
        }
    }
    request(options,callback);
}

module.exports = SinaLogin;
