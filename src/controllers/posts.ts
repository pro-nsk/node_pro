import { Request, Response, NextFunction } from "express";
import { Post } from "../models/Post";
import { check, validationResult, body } from "express-validator";

/**
 * GET /posts
 * Posts page.
 */
export const getPosts = (req: Request, res: Response) => {
    Post.find().sort({'_id': -1}).exec((err, articles) => {
        if (!err) {
            return res.send(articles);
        } else {
            res.statusCode = 500;
            // log.error('Internal error(%d): %s',res.statusCode,err.message);
            return res.send({ error: 'Server error' });
        }
    });
};

/**
 * POST /posts
 * New post.
 */
export const newPost = (req: Request, res: Response, next: NextFunction) => {

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