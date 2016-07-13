const SinaLogin = require('./sinalogin');

let account = {
    username:'18765937002',
    password:'iou521',
    cookiefile:'cookie.bat'
};
let sina = new SinaLogin(account,function (err) {
    if (err) {return console.log(err.meessage);}
});
sina.login();
console.log(sina.cookieLoad());
