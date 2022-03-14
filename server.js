const { response } = require('express');
const express = require('express');
const app = express();
//port-------------------------------------
const port = 8080
//-----------------------------------------
const sanitizeHtml = require('sanitize-html');
//-----------------------------------------
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
require('dotenv').config();
//middleWareを使う
app.use(bodyParser.urlencoded({extended : true}));
app.use(methodOverride('_method'));
//staticファイルを使うためにpublicフォルダーを指定
app.use('/public', express.static('public'));
app.set('view engine', 'ejs');

//mongoDB---------------------------------------------------------------------------------------------------------------------------------------------------
const MongoClient = require('mongodb').MongoClient;
MongoClient.connect("mongodb+srv://thdwo123:dyd123@cluster0.xylcy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", function(error, client){
    if(error) return console.log(error)
    db = client.db('ToDo_App');

    //environment variableの情報によってサーバーを開けてください。
    app.listen(port, function() {
        console.log('listening at http://localhost:%s', port)
    });

    //アカウントをデーターベースに登録
    app.post('/register', nocache, function(req, response){

        var textID = req.body.id
        var textPW = req.body.pw

        //ID,PW文字数制限
        if(textID.length < 6 || textID.length > 16){
            response.status(400).send('IDの文字数が6未満か16を超過しています。')
        }else if(textPW.length < 6 || textPW.length > 16) {
            response.status(400).send('PWの文字数が6未満か16を超過しています。')
        }else {
            db.collection('login').findOne({id:req.body.id},function(error,result){
                //同じIDがあるか判定
                if(result != null){ 
                    response.status(400).send('同じIDが存在しています。')
                } else{
                    console.log('生成可能なIDです。')
                    var tempIsAdmin = false;
                    if(req.body.isadmin =="on") tempIsAdmin = true;
                    db.collection('login').insertOne( { id: req.body.id, pw: req.body.pw, admin: tempIsAdmin }, function(error, result){
                        response.redirect('/')
                    })
                }
            })
        }
    })

    //post追加
    app.post('/add', IsPostBlank, function(req, response){
        //response.send('send Over');
        db.collection('counter').findOne({name: 'postNumber'}, function(error, result){
            if(error) return console.log(error)
            //console.log(result.totalPost);
            var totalPostNum = parseInt(result.totalPost);
            var productStock = parseInt(req.body.Stock);

            //HardCoding-Post Characters Limit---------------------------------------
            //ProductName 30, ProductInfo 240, Stock <= 50
            req.body.ProductName = req.body.ProductName.substr(0,30)
            req.body.ProductInfo = req.body.ProductInfo.substr(0,240)
            if(req.body.Stock >= 51) {
                req.body.Stock = 50
            }
            //-----------------------------------------------------------------------
            var post = { _id: totalPostNum + 1, writer: req.user.id, writerCode: req.user._id, ProductName: req.body.ProductName, ProductInfo: req.body.ProductInfo,  Stock: productStock }

            db.collection('post').insertOne( post, function(error, result){
                console.log('DBsave is Over')

                db.collection('counter').updateOne({name: 'postNumber'},{ $inc : {totalPost:1}},function(){
                    if(error){return console.log(error)}
                })
            });
        });
        
        response.redirect('/list')
    });
});
//-----------------------------------------------------------------------------------------------------------------------------------------------------------

//LOG IN-------------------------------------------------------------------------------------------------------------------------------------------
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

app.use(session({secret: 'password', resave: true, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/logout', nocache, function(req, response) {
    console.log(req.user.id + ' さんがLogOutしました。')
    response.clearCookie('connect.sid');
    response.redirect('/');
});

app.get('/login', IsLoggedIn, function(req, response){
    response.render('login.ejs', {user: req.user})
});

app.post('/login', passport.authenticate('local', {
    failureRedirect: '/Loginfail'
}), function(req, response){
    console.log(req.user);

    response.redirect('/')
});

//session
passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw',
    session: true,
    passReqToCallback: false,
}, function (inputID, inputPW, done) {
    console.log(inputID, inputPW);
    db.collection('login').findOne({ id: inputID }, function (error, result) {
      if (error) return done(error)

      if (!result) return done(null, false, { message: 'Input ID does not exist.' })

      //PW比較に暗号化必要
      if (inputPW == result.pw) {
        return done(null, result)
      } else {
        return done(null, false, { message: 'Password is wrong' })
      }
    })
}));

//serializeUser > deserializeUser
passport.serializeUser(function(user, done){
    done(null, user.id)
});
passport.deserializeUser(function(userID, done){
    //ここでユーザー情報を使ってmypageを構成する。
    db.collection('login').findOne({id : userID}, function(error, result){
        if (error) return done(error)
        done(null, result)
    })
});
//--------------------------------------------------------------------------------------------------------------------------------------------------

//Homeへ移動----------------------------------------------------------------------
app.get('/', nocache, function(req, response){
    db.collection('post').find().toArray(function(error, result){
        if(error) return console.log(error)
        //console.log(result);
        response.render('boxTest.ejs', {posts: result, user: req.user})
    });
});
//--------------------------------------------------------------------------------

//ポスト作成ページ移動--------------------------------------------------------------
app.get('/write', nocache, AYLogin, function(req, response){

    response.render('write.ejs', {user: req.user})
});
//--------------------------------------------------------------------------------

//リストアップページへ移動----------------------------------------------------------
app.get('/list', AYLogin, function(req, response){
    db.collection('post').find().toArray(function(error, result){
        if(error) return console.log(error)
        //console.log(result);
        response.render('list.ejs', {posts : result, user: req.user})
    });
});
//--------------------------------------------------------------------------------

//削除------------------------------------------------------------------------------
app.delete('/delete', AYWriter, nocache, function(req, response){
    console.log('Request to delete');
    // console.log(req.body.postData._id);

    req.body.postData._id = parseInt(req.body.postData._id)
    var toData = {}

    if(req.user.admin){
        toData = { _id : req.body.postData._id }
    } else { 
        toData = { _id : req.body.postData._id, writerCode : req.user._id }
    }

    db.collection('post').deleteOne(toData, function(error, result){
        if(error) { return console.log(error) }
        console.log('delete is Over')
        if(result) {console.log(result)}

        response.status(200).send({ message: '削除成功' });
    })
});
//-----------------------------------------------------------------------------------

//修正------------------------------------------------------------------------------
app.put('/edit', nocache, IsPostBlank, function(req, response){

    //HardCoding-Post Characters Limit---------------------------------------
    //ProductName 30, ProductInfo 240, Stock <= 50
    req.body.ProductName = req.body.ProductName.substr(0,30)
    req.body.ProductInfo = req.body.ProductInfo.substr(0,240)
    if(req.body.Stock >= 51) {
        req.body.Stock = 50
    }
    //-----------------------------------------------------------------------

    db.collection('post').updateOne({ _id: parseInt(req.body.id) }, { $set : { ProductName: req.body.ProductName, ProductInfo: req.body.ProductInfo, Stock: req.body.Stock }}, function(error, result){
        if(error) return console.log(error)
        if(req.body === NaN){
            response.send("<script>alert('このポストはもう存在しません。'); window.location.replace('/list')</script>;");
        }

        console.log('修正完了')
        //response.status(200).send('修正成功');
        response.redirect('/list')
    })
});

app.get('/edit/:id', nocache, function(req, response){
    console.log('Request to Edit');

    db.collection('post').findOne({_id : parseInt(req.params.id)}, function(error, result){
        if(error) { return console.log(error) }

        var tempPostCode = result.writerCode.toString()
        var tempUserCode = req.user._id.toString()
        console.log(tempPostCode)
        console.log(tempUserCode)
        if(tempPostCode == req.user._id){
            response.render('edit.ejs', {post : result});
        } else {
            response.send("<script>alert('あなたが作成した文書ではありません。'); window.location.replace('/list')</script>;");
        }
    })
});
//----------------------------------------------------------------------------------

//検索----------------------------------------------------------------------------
app.get('/search', nocache, (req, response) => {
    console.log(req.query.value)
    req.query.value = sanitizeHtml(req.query.value)
    console.log(req.query.value)
    
    db.collection('post').find({ 'ProductName': {'$regex': req.query.value, '$options': 'i' }}).toArray((error, result) => {
        console.log(result)
        response.render('search.ejs', {posts : result, user : req.user})
    })
});
//----------------------------------------------------------------------------------

//MiddleWare------------------------------------------------------------------------
//Confirm Login: middleWare
function AYLogin(req, response, next){
    if(req.user){
        next()
    } else {
        response.send("<script>alert('You are not logged in. please Log in!'); window.location.replace('/login')</script>;");
        //response.send('You are not logged in. please getting back!')
    }
}

//Confirm Writer: middleWare
function AYWriter(req, response, next){
    
    var tempUserCode = String(req.user._id)
    var tempPostCode = String(req.body.postData.wcode)
    //console.log(tempUserCode)
    //console.log(tempPostCode)

    if(tempUserCode == tempPostCode || req.user.admin == true){
        next()
    } else {
        response.status(400).send('あなたが作成した文書ではありません。')
    }
};

//Confirm Post Input Blank: middleWare
function IsPostBlank(req, response, next){
    console.log(req.body)
    var textPName = req.body.ProductName
    var textPInfo = req.body.ProductInfo
    var PStock = parseInt(req.body.Stock)

    if(textPName === '' || textPInfo === '' || isNaN(PStock)){
        response.send("<script>alert('ポストに空欄があります。'); history.go(-1);</script>");
    }else {
        next()
    }
}

//Confirm logged In
function IsLoggedIn(req, response, next) {
    if(req.user){
        response.render('loggingin.ejs', {user: req.user})
    } else {
        next()
    }
}
//----------------------------------------------------------------------------------

//back制限--------------------------------------------------------------------------
function nocache(req, response, next) {
    response.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    response.header('Expires', '-1');
    response.header('Pragma', 'no-cache');
    next();
}
//----------------------------------------------------------------------------------

//※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※
//未実装----------------------------------------------------------------------------
//detail/ページをget要請をしたら
app.get('/detail/:id', function(req, response){
    db.collection('post').findOne({ _id : parseInt(req.params.id) }, function(error, result){
        if(error) return console.log(error)
        //console.log(result);
        response.render('detail.ejs', { data: result });
    })
});

app.get('/mypage', function(req, response){
    response.render('mypage.ejs', {user: req.user});
});

//IMAGE
let multer = require('multer');
const res = require('express/lib/response');
var storage = multer.diskStorage({
    destination : function(req, file, cb){
        cb(null, './public/image')
    },
    filename : function(req, file, cb){
        cb(null, file.originalname)
    }
});

var upload = multer({storage : storage});

app.get('/upload', function(req, response){
    response.render('upload.ejs');
});

app.post('/upload', upload.single('productPic'), function(req, response){
    response.send('Upload Completed')
});

app.get('/image/:imageName', function(req, response){
    response.sendFile( __dirname + '/public/image/' + req.params.imageName)
});

// app.use('/shop', require('./routes/shop.js'));
// app.use('/board/sub', require('./routes/board.js'));
//app.use('/board/sub', require('./routes/board.js'));

// app.get('/shop/shirts', function(req, response){
//     response.send('This is shirts page.');
// })

// app.get('/shop/pants', function(req, response){
//     response.send('This is shirts page.');
// })
//----------------------------------------------------------------------------------
//※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※※