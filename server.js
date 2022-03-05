const { response } = require('express');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
require('dotenv').config();

//middleWareを使う
app.use(bodyParser.urlencoded({extended : true}));
app.use(methodOverride('_method'));
//staticファイルを使うためにpublicフォルダーを指定
app.use('/public', express.static('public'));

app.set('view engine', 'ejs');

const MongoClient = require('mongodb').MongoClient;
MongoClient.connect("mongodb+srv://thdwo123:dyd123@cluster0.xylcy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", function(error, client){
    if(error) return console.log(error)
    db = client.db('ToDo_App');

    //environment variableの情報によってサーバーを開けてください。
    app.listen(8080, function() {
        console.log('listening on 8080');
    });

    app.post('/register', function(req, response){
        var tempIsAdmin = false;
        if(req.body.isadmin =="on") tempIsAdmin = true;

        db.collection('login').insertOne( { id: req.body.id, pw: req.body.pw }, function(error, result){

            //console.log(req.body.isadmin);
            response.redirect('/')
        })
        //Need to develop ID duplicate verification function.
    })

    app.post('/add',  function(req, response){
        //response.send('send Over');
        db.collection('counter').findOne({name: 'postNumber'}, function(error, result){
            if(error) return console.log(error)
            //console.log(result.totalPost);
            var totalPostNum = parseInt(result.totalPost);
            var productStock = parseInt(req.body.Stock);
            //
            var post = { _id: totalPostNum + 1, writer: req.user.id, writerCode: req.user._id, ProductName: req.body.ProductName, ProductInfo: req.body.Info,  Stock: productStock }

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

//LOG IN----------------------------------------------------------------------------
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

app.use(session({secret: 'password', resave: true, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/logout', function(req, response) {

    console.log(req.user.id + '　さんがLogOutしました。')
    response.clearCookie('connect.sid');
    response.redirect('/');
});

app.get('/login', function(req, response){
    response.render('login.ejs', {user: req.user})
});

app.post('/login', passport.authenticate('local', {
    failureRedirect: '/Loginfail'
}), function(req, response){
    console.log(req.user);
    
    response.redirect('/list')
});

app.get('/mypage', function(req, response){
    response.render('mypage.ejs', {user: req.user});
});

//Confirm Login: middleWare
function AYLogin(req, response, next){
    if(req.user){
        next()
    } else {
        response.send('You are not logged in. please getting back!')
    }
}

//Confirm Writer: middleWare
function AYWriter(req, response, next){
    req.body._id = parseInt(req.body._id);
    console.log(req.body._id)
    console.log(req.user.id)
    if(req.user.id == req.body._id){
        next()
    } else {
        response.send('You are not this post\'s writer!! please getting back!!')
    }
}

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


//----------------------------------------------------------------------------------

app.get('/', function(req, response){
    db.collection('post').find().toArray(function(error, result){
        if(error) return console.log(error)
        //console.log(result);
        response.render('boxTest.ejs', {posts: result, user: req.user})
    });
});

app.get('/write', AYLogin, function(req, response){
    response.render('write.ejs', {user: req.user})
});

app.get('/list',AYLogin , function(req, response){

    db.collection('post').find().toArray(function(error, result){
        if(error) return console.log(error)
        //console.log(result);
        response.render('list.ejs', {posts : result, user: req.user})
    });
});

app.get('/search', (req, response) => {
    console.log(req.query)

    var searchRequirement = [
        {
          $search: {
            index: 'productSearch',
            text: {
              query: req.query.value,
              path: 'ProductName'  // If you search 2 sctions ['ProductName', 'ProductInfo']
            }
          }
        }
    ] 

    db.collection('post').aggregate(searchRequirement).toArray((error, result) => {
        console.log(result)
        response.render('search.ejs', {posts : result, user : req.user})
    })
});

app.delete('/delete', function(req, response){
    console.log('Request to delete');
    console.log(req.body._id);

    //postNumber
    req.body._id = parseInt(req.body._id);
    var toData = { _id : req.body._id, writerCode : req.user._id}

    db.collection('post').deleteOne(toData, function(error, result){
        if(error) { return console.log(error) }
        console.log('delete is Over')
        if(result) {console.log(result)}
        response.status(200).send({ message : '削除に成功しました。' })
    })
});

//detail/ページをget要請をしたら
app.get('/detail/:id', function(req, response){
    db.collection('post').findOne({ _id : parseInt(req.params.id) }, function(error, result){
        if(error) return console.log(error)
        //console.log(result);
        response.render('detail.ejs', { data: result });
    })
});

//Edit----------------------------------------------------------------------------
app.put('/edit', function(req, response){
    db.collection('post').updateOne({ _id: parseInt(req.body.id) }, { $set : { ProductName: req.body.ProductName, Info: req.body.ProductInfo, Stock: req.body.Stock }}, function(error, result){
        if(error) return console.log(error)
        console.log('修正完了')
        response.redirect('/list')
    })
});

app.get('/edit/:id', function(req, response){
    console.log('Request to Edit');
    db.collection('post').findOne({_id : parseInt(req.params.id)}, function(error, result){
        if(error) {
            //response.render('boxTest.ejs');
            return console.log(error)
        }
        response.render('edit.ejs', {post : result} );
    })
});
//----------------------------------------------------------------------------------


//IMAGE----------------------------------------------------------------------------
let multer = require('multer');
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
//----------------------------------------------------------------------------------


// app.use('/shop', require('./routes/shop.js'));
// app.use('/board/sub', require('./routes/board.js'));

app.use('/board/sub', require('./routes/board.js'));

// app.get('/shop/shirts', function(req, response){
//     response.send('This is shirts page.');
// })

// app.get('/shop/pants', function(req, response){
//     response.send('This is shirts page.');
// })
