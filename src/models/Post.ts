import mongoose from 'mongoose'
import random from 'mongoose-simple-random'

export type PostDocument = mongoose.Document & {
    urlName: string
    imageUrl: string
    text: string
}

const postSchema = new mongoose.Schema({
    urlName: {type: String, index: true},
    imageUrl: String,
    text: String
})

postSchema.plugin(random)

export const Post = mongoose.model<PostDocument>('Post', postSchema)