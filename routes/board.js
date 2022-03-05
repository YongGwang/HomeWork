var router = require('express').Router();

router.get('/sports', function(req, response){
    response.send('This is sports page.');
})

router.get('/game', function(req, response){
    response.send('This is game page.');
})

router.get('/fail', function(req, response){
    response.send('You are not a member.');
})

module.exports = router;