var router = require('express').Router();

function AYLogin(req, response, next){
    if(req.user){
        next()
    } else {
        response.send('You haven\'t logged in.')
    }
}

router.use('/shirts', AYLogin);

router.get('/shirts', function(req, response){
    response.send('This is shirts page.');
})

router.get('/pants', function(req, response){
    response.send('This is shirts page.');
})

module.exports = router;