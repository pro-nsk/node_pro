import {Request, Response, NextFunction} from 'express'
import {Post, PostDocument} from '../models/Post'
import {check, validationResult, sanitize} from 'express-validator'
import {ActionType} from '../util/enums'

const PAGE_SIZE = 10
const RANDOM_SIZE = 9

export const validate = (method: ActionType) => {
    switch (method) {
        case ActionType.create: {
            return [
                check('imageUrl', 'incorrect image url').isURL(),
                check('urlName', 'spaces are not allowed in url name').not().contains(' '),
                check('urlName', 'reserved url name').not().equals('create'),
                check('urlName', 'reserved url name').not().equals('edit'),
                check('urlName', 'reserved url name').not().equals('login'),
                check('urlName', 'reserved url name').not().equals('logout'),
                check('urlName', 'reserved url name').not().equals('register'),
                sanitize('urlName').customSanitizer(url => {
                    if (url != undefined && url.length == 0) {
                        return undefined
                    } else {
                        return url
                    }
                })
            ]
        }
    }
}

/**
 * GET /home/:page
 * Home page.
 */
export const getPosts = (req: Request, res: Response) => {
    Post.find().sort({'_id': -1}).skip(PAGE_SIZE * req.params.page).limit(PAGE_SIZE).exec((err, posts) => {
        if (!err) {
            posts.forEach(post => {
                if (post.text && post.text.length > 200) {
                    post.text = post.text.substring(0, 200) + '... '
                }
            })
            res.statusCode = 200
            return res.send(posts)
        } else {
            res.statusCode = 500
            return res.send({error: 'server error'})
        }
    })
}

/**
 * GET /home
 * Home page.
 */
export const getRandomPosts = (req: Request, res: Response) => {
    Post.findRandom({}, {}, {limit: RANDOM_SIZE}, function(err, posts) {
        if (!err) {
            posts.forEach(post => {
                // post.urlName = undefined
                // post.text = undefined
            })
            res.statusCode = 200
            return res.send(posts)
        } else {
            res.statusCode = 500
            return res.send({error: 'server error'})
        }
    })
}

/**
 * GET /menu
 * Post list.
 */
export const getPostList = (req: Request, res: Response) => {
    Post.find({urlName: {$exists: true}}).select('urlName').sort({'_id': -1}).exec((err, posts) => {
        if (!err) {
            res.statusCode = 200
            return res.send(posts)
        } else {
            res.statusCode = 500
            return res.send({error: 'server error'})
        }
    })
}

/**
 * GET /post/id
 * Post entity.
 */
export const getPost = (req: Request, res: Response) => {
    Post.findById(req.params.id, (err, article) => {
        if (!article) {
            res.statusCode = 404
            return res.send({error: 'not found'})
        }
        if (!err) {
            return res.send(article)
        } else {
            res.statusCode = 500
            return res.send({error: 'server error'})
        }
    })
}

/**
 * GET /urlname
 * Post entity by url name.
 */
export const findByUrlName = (req: Request, res: Response) => {
    Post.findOne({urlName: req.params.urlname}, (err, post) => {
        if (!post) {
            res.statusCode = 404
            return res.send({error: 'not found'})
        }
        if (!err) {
            res.statusCode = 200
            return res.send(post)
        } else {
            res.statusCode = 500
            return res.send({error: 'server error'})
        }
    })
}


/**
 * POST /post
 * New post.
 */
export const createPost = (req: Request, res: Response, next: NextFunction) => {

    const errors = validationResult(req)

    if (!errors.isEmpty()) {
        res.statusCode = 400
        //TODO: rework of send errors
        return res.send({error: errors.array()[0].msg})
    }

    let post = new Post({
        urlName: req.body.urlName,
        imageUrl: req.body.imageUrl,
        text: req.body.text
    })

    let saveFunc = (post: PostDocument) => post.save(err => {
        if (!err) {
            return res.sendStatus(200)
        } else {
            res.statusCode = 500
            return res.send({error: 'server error'})
        }
    })

    if (req.body.urlName != undefined) {
        Post.findOne({urlName: req.body.urlName}, (err, existingPost) => {
            if (err) {return next(err)}
            if (existingPost) {
                res.statusCode = 400
                return res.send({error: 'post with that url name already exists'})
            }
            saveFunc(post)
        })
    } else {
        saveFunc(post)
    }
}

/**
 * PUT /post/:id
 * Edit post.
 */
export const editPost = (req: Request, res: Response, next: NextFunction) => {

    const errors = validationResult(req)

    if (!errors.isEmpty()) {
        res.statusCode = 400
        //TODO: rework of send errors
        return res.send({error: errors.array()[0].msg})
    }

    Post.findById(req.params.id, (err, post) => {
        if (!post) {
            res.statusCode = 404
            return res.send({error: 'not found'})
        }

        post.urlName = req.body.urlName
        post.imageUrl = req.body.imageUrl
        post.text = req.body.text

        let saveFunc = (post: PostDocument) => post.save(err => {
            if (!err) {
                return res.sendStatus(200)
            } else {
                res.statusCode = 500
                return res.send({error: 'server error'})
            }
        })

        if (req.body.urlName != undefined) {
            Post.findOne({urlName: req.body.urlName}, (err, existingPost) => {
                if (err) {return next(err)}
                if (existingPost && existingPost._id != req.params.id) {
                    res.statusCode = 400
                    return res.send({error: 'post with that url name already exists'})
                }
                saveFunc(post)
            })
        } else {
            saveFunc(post)
        }
    })
}

/**
 * DELETE /post
 * Posts page.
 */
export const deletePost = (req: Request, res: Response) => {
    Post.findById(req.params.id, (err, article) => {
        if (!article) {
            res.statusCode = 404
            return res.send({error: 'not found'})
        }
        return article.remove(err => {
            if (!err) {
                return res.sendStatus(200)
            } else {
                res.statusCode = 500
                return res.send({error: 'server error'})
            }
        })
    })
}