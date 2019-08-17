import express from 'express'
import compression from 'compression'  // compresses requests
import session from 'express-session'
import bodyParser from 'body-parser'
import lusca from 'lusca'

import mongo from 'connect-mongo'
import flash from 'express-flash'
import path from 'path'
import mongoose from 'mongoose'
import passport from 'passport'
import bluebird from 'bluebird'
import {MONGODB_URI, SESSION_SECRET} from './util/secrets'

const MongoStore = mongo(session)

// Controllers (route handlers)
import * as userController from './controllers/user'
import * as postController from './controllers/post'


// API keys and Passport configuration
import * as passportConfig from './config/passport'

import {ActionType} from './util/enums'

// Create Express server
const app = express()

const login = ActionType.login
const create = ActionType.create

// Connect to MongoDB
const mongoUrl = MONGODB_URI
mongoose.Promise = bluebird

mongoose.connect(mongoUrl, {useNewUrlParser: true}).then(
    () => { /** ready to use. The `mongoose.connect()` promise resolves to undefined. */},
).catch(err => {
    console.log('MongoDB connection error. Please make sure MongoDB is running. ' + err)
    // process.exit()
})

// Express configuration
app.set('port', process.env.PORT || 3000)
app.set('views', path.join(__dirname, '../views'))
app.set('view engine', 'pug')
app.use(compression())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: SESSION_SECRET,
    store: new MongoStore({
        url: mongoUrl,
        autoReconnect: true
    })
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())
app.use(lusca.xframe('SAMEORIGIN'))
app.use(lusca.xssProtection(true))
app.use((req, res, next) => {
    res.locals.user = req.user
    next()
})
app.use((req, res, next) => {
    // After successful login, redirect back to the intended page
    if (!req.user &&
        req.path !== '/login' &&
        req.path !== '/signup' &&
        !req.path.match(/^\/auth/) &&
        !req.path.match(/\./)) {
        req.session.returnTo = req.path
    } else if (req.user &&
        req.path == '/account') {
        req.session.returnTo = req.path
    }
    next()
})

app.use(
    express.static(path.join(__dirname, 'public'), {maxAge: 31557600000})
)

app.use((req, res, next) => {
    let origin = req.get('origin')
    if (origin != undefined) {
        res.header('Access-Control-Allow-Origin', origin)
    } 
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE')
    res.header('Access-Control-Allow-Credentials', 'true')
    next()
})

/**
 * Primary app routes.
 */
app.get('/post', postController.getPosts)
app.post('/post', postController.validate(create), passportConfig.isAuthenticated, postController.createPost)
app.delete('/post/:id', passportConfig.isAuthenticated, postController.deletePost)

app.post('/login', userController.validate(login), userController.postLogin)
app.get('/logout', userController.logout)

app.post('/register',userController.validate(create),userController.postRegister)

export default app