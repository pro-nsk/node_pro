import {Request, Response, NextFunction} from 'express'
import {Post, PostDocument} from '../models/Post'
import {check, validationResult, sanitize} from 'express-validator'
import {ActionType} from '../util/enums'
import {GPU} from 'gpu.js'
import {createCanvas, loadImage} from 'canvas'

const PAGE_SIZE = 10

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
            if (article.urlName == 'test-url') {
                console.log('ok')
            }

            return res.send(article)
        } else {
            res.statusCode = 500
            return res.send({error: 'server error'})
        }
    })
}

const image = new Promise(function (resolve, reject) {
    var img = new Image()
    img.crossOrigin = ''
    img.src = 'https://farm4.staticflickr.com/3138/2811419692_d101c2e926_b.jpg' // "https://farm4.staticflickr.com/3138/2811419692_18c6205e88_o.jpg"
    img.onload = _ => resolve(img)
    img.onerror = _ => reject(_)
})

// const fib = (n) => {
//     return n <= 1 ? n : fib(n - 1) + fib(n - 2)
// }

const gpu = new GPU()

// const multiplyMatrix = gpu.createKernel(function(a: number[][], b: number[][]) {
//     let sum = 0
//     for (let i = 0; i < 512; i++) {
//         sum += a[this.thread.y][i] * b[i][this.thread.x]
//     }
//     return sum
// }).setOutput([512, 512])


function applyRotation(rotatex, rotatey, rotatez, lambda, phi, which) {
    var degrees = 57.29577951308232

    lambda = lambda / degrees
    phi = phi / degrees

    var cosphi = Math.cos(phi),
        x = Math.cos(lambda) * cosphi,
        y = Math.sin(lambda) * cosphi,
        z = Math.sin(phi)

    // inverse rotation
    var deltaLambda = rotatex / degrees // rotate[0]
    var deltaPhi = -rotatey / degrees  // rotate[1]
    var deltaGamma = -rotatez / degrees // rotate[2]

    var cosDeltaPhi = Math.cos(deltaPhi),
        sinDeltaPhi = Math.sin(deltaPhi),
        cosDeltaGamma = Math.cos(deltaGamma),
        sinDeltaGamma = Math.sin(deltaGamma)

    var k = z * cosDeltaGamma - y * sinDeltaGamma

    lambda = Math.atan2(
        y * cosDeltaGamma + z * sinDeltaGamma,
        x * cosDeltaPhi + k * sinDeltaPhi
    ) - deltaLambda
    k = k * cosDeltaPhi - x * sinDeltaPhi

    phi = Math.asin(k)

    lambda *= degrees
    phi *= degrees

    // return [lambda,phi]; // fails so we need to call this function twice
    // and ask first for lambda, then for phi
    if (which == 0) return lambda
    else return phi
}

function frac(n) {
    return n - Math.floor(n)
}

const kernel = function (pixels, rotate0, rotate1, rotate2, scale) {

    // azimuthal equal area
    function radius(rho) {
        return 2.0 * Math.asin(rho / 2.0)
    }
    // orthographic
    function __radius(rho) {
        return Math.asin(rho)
    }

    // equirectangular projection (reads the (lon,lat) color from the base image)
    function pixelx(lon, srcw) {
        lon = frac((lon + 180) / 360)
        return Math.floor(lon * srcw)
    }
    function pixely(lat, srch) {
        lat = frac((lat + 90) / 180)
        return Math.floor(lat * srch)
    }

    const x = (this.thread.x / this.constants.w - 1 / 2) / scale,
        y = ((this.thread.y - this.constants.h / 2) / this.constants.w) / scale

    // inverse projection
    const rho = Math.sqrt(x * x + y * y) + 1e-12

    const c = radius(rho),
        sinc = Math.sin(c),
        cosc = Math.cos(c)

    // x, y :  pixel coordinates if rotation was null
    const lambda = Math.atan2(x * sinc, rho * cosc) * 57.29577951308232
    const z = y * sinc / rho
    if (Math.abs(z) < 1) {
        const phi = Math.asin(z) * 57.29577951308232

        // apply rotation
        // [lambda, phi] = applyRotation(centerx, centery, centerz, lambda, phi); // TODO
        const lambdan = applyRotation(rotate0, rotate1, rotate2, lambda, phi, 0)
        const phin = applyRotation(rotate0, rotate1, rotate2, lambda, phi, 1)
        //var n = n0(lambda, phi, this.constants.srcw, this.constants.srch);
        //this.color(pixels[n]/256, pixels[n+1]/256,pixels[n+2]/256,1);
        const pixel = pixels[pixely(phin, this.constants.srch)][pixelx(lambdan, this.constants.srcw)]
        this.color(pixel[0], pixel[1], pixel[2], 1)
    }
}

const w = 954
const h = 954

const render = gpu
    .createKernel(kernel, {functions: [applyRotation, frac]})
    .setConstants({w, h, srcw: image.width, srch: image.height})
    .setOutput([w, h])
    .setGraphical(true)

function* compute() {
    var fpsTime = performance.now(), fps = 60
    do {
        let r0 = (-Date.now() / 30) % 360,
            r1 = 35 * Math.sin((-Date.now() / 1030) % 360),
            r2 = 0,
            scale = 0.49
        render(image, r0, r1, r2, scale)
        fps = (1 + fps) * (1 + 0.000984 * (fpsTime - (fpsTime = performance.now())))
        yield fps
    } while (true)
}

// function mySuperFunction(a, b) {
//     return a - b
// }

// function fib(n) {
//     return n <= 1 ? n : fib(n - 1) + fib(n - 2)
// }

// function anotherFunction(value) {

//     // const fib = function (n) {
//     //     return n <= 1 ? n : fib(n - 1) + fib(n - 2)
//     // }


//     // fib(3)
//     // console.log(fib(7))
//     // console.log(fib(42))

//     let a = 1312 * 13123123131353
//     a = 1312 * 13123123131353
//     a = 1312 * 13123123131353
//     a = 1312 * 13123123131353
//     a = 1312 * 13123123131353
//     a = 1312 * 13123123131353
//     a = 1312 * 13123123131353
//     a = 1312 * 13123123131353


//     return 1312 * 13123123131353
// }

// const multiplyMatrix = gpu.createKernel(function (a, b) {

//     // const fib = function (n) {
//         // return n <= 1 ? n : fib(n - 1) + fib(n - 2)
//     // }


//     // fib([3])
//     // console.log(fib(7))
//     // console.log(fib(42))

//     // return mySuperFunction(a[this.thread.x], b[this.thread.x])
//     return anotherFunction(6)
//     // return fib(3)
// }, {
//     output: [1],
//     functions: [mySuperFunction, anotherFunction, fib]
// })

// const c = multiplyMatrix([1345, 234], [23423, 2343])

// console.log(c)

// const render = gpu.createKernel(function (x) {
//     this.color(this.thread.x / 500, this.thread.y / 500, x[0], 0.3)
// })
//     .setOutput([500, 500])
//     .setGraphical(true)

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
            if (post.urlName == 'test-url') {



                // const canvas = createCanvas(200, 200)
                // const ctx = canvas.getContext('2d')

                // Write "Awesome!"
                // ctx.font = '30px Impact'
                // ctx.fillStyle = '#fff'
                // ctx.rotate(0.1)
                // ctx.fillText('Awesaome!', 50, 100)

                // Draw line under text
                // var text = ctx.measureText('Awesaome!')
                // ctx.strokeStyle = 'rgba(0,0,0,0.5)'
                // ctx.beginPath()
                // ctx.lineTo(50, 102)
                // ctx.lineTo(50 + text.width, 102)
                // ctx.stroke()
                // ctx.fillText('flaviocopes.com', 600, 530)

                // Draw cat with lime helmet
                // loadImage('./1.png').then((image) => {
                //     ctx.drawImage(image, 50, 0, 70, 70)

                //     console.log('<img src="' + canvas.toDataURL() + '" />')

                //     // const buffer = canvas.toBuffer('image/png')

                //     // canvas.createPNGStream().pipe(res)


                //     res.send('<img src="' + canvas.toDataURL() + '" />')
                // })

                // return res.send('<img src="' + canvas.toDataURL() + '" />')
                // console.log(fib(3))
                // console.log(fib(7))
                // console.log(fib(42))
                // console.log(c) // 3

                compute()
            }
            res.statusCode = 200
            return res.send(post)
        } else {
            res.statusCode = 500
            return res.send({error: 'server error'})
        }
    })
}

export const testResponse = (req: Request, res: Response) => {
    // console.log('ok')
    res.statusCode = 200
    return res.send({'email': 'ok'})
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