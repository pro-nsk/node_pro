import passport from 'passport'
import {User, UserDocument} from '../models/User'
import {Request, Response, NextFunction} from 'express'
import {IVerifyOptions} from 'passport-local'
import {check, sanitize, validationResult} from 'express-validator'
import '../config/passport'
import {ActionType} from '../util/enums'

export const validate = (method: ActionType) => {
    switch (method) {
        case ActionType.login: {
            return [
                check('email', 'email is not valid').isEmail(),
                check('password', 'password cannot be blank').isLength({min: 1}),
            ]
        }
        case ActionType.create: {
            return [
                check('email', 'email is not valid').isEmail().equals('motors@live.ru'),
                check('password', 'password must be at least 4 characters long').isLength({min: 4}).custom((value, {req, location, path}) => {
                    if (value !== req.body.confirmPassword) {
                        throw new Error('passwords don\'t match')
                    } else {
                        return value
                    }
                }),
            ]
        }
    }
}

/**
 * POST /login
 * Login using email and password.
 */
export const postLogin = (req: Request, res: Response, next: NextFunction) => {

    // eslint-disable-next-line @typescript-eslint/camelcase
    sanitize('email').normalizeEmail({gmail_remove_dots: false})

    const errors = validationResult(req)

    if (!errors.isEmpty()) {
        res.statusCode = 400
        return res.send({error: errors.array()[0].msg})
    }

    passport.authenticate('local', (err: Error, user: UserDocument, info: IVerifyOptions) => {
        if (err) {return next(err)}
        if (!user) {
            res.statusCode = 400
            return res.send({error: info.message})
        }
        req.logIn(user, (err) => {
            if (err) {return next(err)}
            res.statusCode = 200
            res.send({success: 'success! you are logged in'})
        })
    })(req, res, next)
}

/**
 * GET /logout
 * Log out.
 */
export const logout = (req: Request, res: Response) => {
    req.logout()
    res.sendStatus(200)
}

/**
 * POST /register
 * Create a new local account.
 */
export const postRegister = (req: Request, res: Response, next: NextFunction) => {

    // eslint-disable-next-line @typescript-eslint/camelcase
    sanitize('email').normalizeEmail({gmail_remove_dots: false})

    const errors = validationResult(req)

    if (!errors.isEmpty()) {
        res.statusCode = 400
        return res.send({error: errors.array()[0].msg})
    }

    const user = new User({
        email: req.body.email,
        password: req.body.password
    })

    User.findOne({email: req.body.email}, (err, existingUser) => {
        if (err) {return next(err)}
        if (existingUser) {
            res.statusCode = 400
            return res.send({error: 'account with that email address already exists'})
        }
        user.save((err) => {
            if (err) {return next(err)}
            req.logIn(user, (err) => {
                if (err) {
                    return next(err)
                }
                return res.sendStatus(200)
            })
        })
    })
}