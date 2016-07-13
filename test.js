const SinaLogin = require('./sinalogin');

let account = {
    username:'18765937002',
    password:'iou521',
    cookiefile:'cookie.bat'
};
let sina = new SinaLogin(account,function (err) {
    console.log(err);
});
sina.login();
