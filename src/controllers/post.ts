import {Request, Response, NextFunction} from "express";
import {Post} from "../models/Post";
import {check, validationResult, body} from "express-validator";
import * as passportConfig from "../config/passport";

export const validate = (method: string) => {
    switch (method) {
        case 'createPost': {
            return [
                check("url", "incorrect url").isURL(),
                passportConfig.isAuthenticated
            ]
        }
    }
}

/**
 * GET /post
 * Posts page.
 */
export const getPosts = (req: Request, res: Response) => {
    Post.find().sort({'_id': -1}).exec((err, articles) => {
        if (!err) {
            return res.send(articles);
        } else {
            res.statusCode = 500;
            // log.error('Internal error(%d): %s',res.statusCode,err.message);
            return res.send({error: 'server error'});
        }
    });
};

/**
 * POST /post
 * New post.
 */
export const createPost = (req: Request, res: Response, next: NextFunction) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        // req.flash("errors", errors.array());
        res.statusCode = 400;
        return res.send({error: errors.array()[0].msg});
    }

    let post = new Post({
        url: req.body.url
    });

    post.save(e => {
        return res.sendStatus(200);
    });
};

/**
 * DELETE /post
 * Posts page.
 */
export const deletePost = (req: Request, res: Response) => {
    Post.findById(req.params.id, (err, article) => {
        if (!article) {
            res.statusCode = 404;
            // return res.send({ error: 'not found' });
        }
        return article.remove(err => {
            if (!err) {
                // return res.sendStatus(200);
            } else {
                res.statusCode = 500;
                // return res.send({ error: 'server error' });
            }
        });
    });
};