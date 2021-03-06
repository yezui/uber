'use strict';
var domain = require('domain');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cloud = require('./cloud');
var menu = require('./routes/menu');
var admin = require('./routes/admin');
var pkgUser = require('./routes/PkgUser');
var Promo = require('./routes/Promo');
var PromoCode = require('./routes/PromoCode');
var AV = require('leanengine');
var event = require('./routes/event');

var app = express();

app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, Accept, X-Requested-With , yourHeaderFeild');
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
    if (req.method == 'OPTIONS') {
        res.send(200);
    }
    else {
        next();
    }
});


app.use(AV.Cloud.CookieSession({secret: 'uberRide', maxAge: 3600000 * 48, fetchUser: true}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());

require("./libs/common/load-express-rate-limit")({app: app});

// 未处理异常捕获 middleware
app.use(function (req, res, next) {
    var d = null;
    if (process.domain) {
        d = process.domain;
    } else {
        d = domain.create();
    }
    d.add(req);
    d.add(res);
    d.on('error', function (err) {
        console.error('uncaughtException url=%s, msg=%s', req.url, err.stack || err.message || err);
        if (!res.finished) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=UTF-8');
            res.end('uncaughtException');
        }
    });
    d.run(next);
});

app.all(/^\/admin\/(?!login[.]).*html$/, function (req, res, next) {
    if (!req.AV.user) {
        res.redirect("/admin/login.html");
    } else {
        next();
    }
});

// 设置 view 引擎
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// 加载云代码方法
app.use(cloud);

require("./libs/normal-promo")({app: app});
require("./libs/ms-promo")({app: app});
require("./libs/vote-promo")({app: app, prefix: "/vote"});

app.use("/promo", Promo);
app.use("/promocode", PromoCode);


app.get('/', function (req, res) {
    res.render('index', {currentTime: new Date()});
});

//登录路由
app.post("/admin_login", function (req, res) {
    AV.User.logIn(req.body.username, req.body.password).then(function (user) {
        res.send({status: true, error: null});
    }, function (error) {
        res.send({status: false, error: error});
    });
});
app.post("/admin_logout", function (req, res) {
    AV.User.logOut();
    res.redirect("/admin/login.html");
});

// 可以将一类的路由单独保存在一个文件中

app.use('/menu', menu);
app.use('/admin', admin);
app.use("/pkgUser", pkgUser);
app.use(event);


// 如果任何路由都没匹配到，则认为 404
// 生成一个异常让后面的 err handler 捕获
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) { // jshint ignore:line
        var statusCode = err.status || 500;
        if (statusCode === 500) {
            console.error(err.stack || err);
        }
        res.status(statusCode);
        res.render('error', {
            message: err.message || err,
            error: err
        });
    });
}

// 如果是非开发环境，则页面只输出简单的错误信息
app.use(function (err, req, res, next) { // jshint ignore:line
    res.status(err.status || 500);
    res.render('error', {
        message: err.message || err,
        error: {}
    });
});

module.exports = app;
